import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, ensureSession, loginRequired } from './supabase.js'
import { fromRow, toRow, mergeRecords, uid } from './domain.js'
import { drainOutbox } from './sync.js'

const prefix = 'nitoron:workspace:v1:'
export default function useWorkspace() {
  const [records, setRecords] = useState([])
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('読み込み中…')
  const [error, setError] = useState('')
  const state = useRef({ records: [], pending: {}, owner: null, session: null })
  const timer = useRef(null), saving = useRef(null), generation = useRef(0), mounted = useRef(true)

  const persist = useCallback(() => {
    const s = state.current
    try {
      localStorage.setItem(prefix + (s.owner || 'device'), JSON.stringify({ records: s.records, pending: s.pending }))
      s.cacheFailed = false
      return true
    } catch {
      s.cacheFailed = true
      setError('端末への一時保存に失敗しました。保存を再試行するか、バックアップを書き出してください。')
      return false
    }
  }, [])

  const flush = useCallback(async () => {
    if (saving.current) return saving.current
    const s = state.current
    if (!s.session || !supabase) { setStatus('この端末に保存'); return false }
    const myGeneration = generation.current
    saving.current = (async () => {
      try {
        setStatus('保存中…')
        const saved = await drainOutbox(s, {
          isCurrent: () => myGeneration === generation.current,
          onSaved: persist,
          write: async record => {
            const { error: writeError } = await supabase.from('notes').upsert(toRow(record, s.owner)).select('id').single()
            if (writeError) throw writeError
          },
        })
        if (!saved) return false
        if (myGeneration === generation.current && mounted.current) { setStatus('クラウドに保存済み'); if (!s.cacheFailed) setError('') }
        return true
      } catch {
        if (myGeneration === generation.current && mounted.current) {
          setStatus(s.cacheFailed ? '保存できていません' : '端末に保存・同期待ち')
          setError('クラウドに保存できませんでした。接続を確認して「再試行」を押してください。')
        }
        return false
      } finally { saving.current = null }
    })()
    return saving.current
  }, [persist])

  const load = useCallback(async (nextSession) => {
    const token = ++generation.current, owner = nextSession?.user.id || null
    clearTimeout(timer.current)
    setReady(false); setSession(nextSession); setError(''); setStatus('読み込み中…')
    let cache = null, legacy = []
    try {
      cache = JSON.parse(localStorage.getItem(prefix + (owner || 'device')) || 'null')
      // Claim legacy device data only once, so switching accounts never imports another user's notes.
      if (!cache && !localStorage.getItem('nitoron:legacy-claimed')) {
        const raw = JSON.parse(localStorage.getItem('nitoron:observations') || '[]')
        if (Array.isArray(raw)) legacy = raw.map(fromRow)
      }
    } catch { setError('端末のバックアップを読み取れませんでした。元のデータは削除していません。') }
    const local = Array.isArray(cache?.records) ? cache.records.map(fromRow) : legacy
    const pending = cache?.pending && typeof cache.pending === 'object' ? { ...cache.pending } : {}
    const s = { owner, session: nextSession, records: local, pending }
    state.current = s
    if (nextSession && supabase) {
      try {
        const data = []
        for (let start = 0; ; start += 500) {
          const { data: page, error: readError } = await supabase.from('notes').select('*').eq('user_id', owner).order('created_at', { ascending: false }).order('id').range(start, start + 499)
          if (readError) throw readError
          if (token !== generation.current || !mounted.current) return
          data.push(...page)
          if (page.length < 500) break
        }
        if (token !== generation.current || !mounted.current) return
        const remote = data.map(fromRow)
        if (!cache) for (const record of legacy) {
          const existing = remote.find(r => r.id === record.id)
          if (!existing) pending[record.id] = uid()
          else if (JSON.stringify(toRow(existing)) !== JSON.stringify(toRow(record))) {
            record.id = uid(); record.title = `${record.title || '無題'}（端末の復元）`; pending[record.id] = uid()
          }
        }
        s.records = mergeRecords(remote, local, pending)
        setStatus(Object.keys(pending).length ? '保存待ち' : 'クラウドに保存済み')
      } catch {
        if (token !== generation.current || !mounted.current) return
        if (!cache) for (const record of legacy) pending[record.id] = uid()
        setStatus('端末の記録を表示'); setError('クラウドの記録を取得できませんでした。再試行してください。')
      }
    } else {
      if (!cache) for (const record of legacy) pending[record.id] = uid()
      setStatus('この端末に保存')
      // ログインすれば繋がる状態はエラーではない。案内は needsLogin で行う。
      if (!supabase || !loginRequired()) setError('クラウドに接続できません。記録はこの端末に保存します。')
    }
    if (token !== generation.current || !mounted.current) return
    setRecords([...s.records]); setReady(true)
    if (persist() && legacy.length) { try { localStorage.setItem('nitoron:legacy-claimed', owner || 'device') } catch { /* backup remains */ } }
    if (nextSession && Object.keys(pending).length) timer.current = setTimeout(flush, 800)
  }, [flush, persist])

  useEffect(() => {
    mounted.current = true
    let booted = false
    ensureSession().then(s => { if (mounted.current) { booted = true; load(s) } }).catch(() => { if (mounted.current) { booted = true; load(null) } })
    const sub = supabase?.auth.onAuthStateChange((_event, s) => {
      if (!booted || !mounted.current) return
      if ((s?.user.id || null) !== state.current.owner) { queueMicrotask(() => { if (mounted.current) load(s) }) }
      else { state.current.session = s; setSession(s) }
    })
    const onOnline = () => flush()
    const beforeUnload = event => {
      if (Object.keys(state.current.pending).length || state.current.cacheFailed) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('online', onOnline); window.addEventListener('beforeunload', beforeUnload)
    return () => { mounted.current = false; generation.current++; clearTimeout(timer.current); sub?.data.subscription.unsubscribe(); window.removeEventListener('online', onOnline); window.removeEventListener('beforeunload', beforeUnload) }
  }, [load, flush])

  const put = useCallback((record, expectedOwner) => {
    const s = state.current
    if (expectedOwner !== undefined && s.owner !== expectedOwner) return null
    s.records = [record, ...s.records.filter(r => r.id !== record.id)]
    s.pending[record.id] = uid(); setRecords([...s.records])
    const cached = persist()
    setStatus(cached ? (s.session ? '端末に保存・同期中…' : 'この端末に保存') : '保存できていません')
    clearTimeout(timer.current); timer.current = setTimeout(flush, 800)
    // 端末への保存に失敗したときは null を返し、呼び出し側が「保存できた」扱いにしないようにする。
    return cached ? record : null
  }, [flush, persist])

  const remove = useCallback(async id => {
    const s = state.current
    if (s.session && supabase) {
      if (!await flush()) throw new Error('先に保存を完了してください。')
      const { error: deleteError } = await supabase.from('notes').delete().eq('id', id).eq('user_id', s.owner)
      if (deleteError) throw new Error('削除できませんでした。')
    }
    s.records = s.records.filter(r => r.id !== id); delete s.pending[id]
    setRecords([...s.records]); persist()
  }, [flush, persist])

  const retry = useCallback(async () => {
    if (state.current.session) {
      if (Object.keys(state.current.pending).length && !await flush()) return
      await load(state.current.session)
    } else {
      const next = await ensureSession()
      // Keep offline work in its own backup; do not silently attach it to an unrelated account.
      if (next) await load(next)
      else if (!supabase || !loginRequired()) setError('接続できませんでした。端末の記録を書き出して保管できます。')
    }
  }, [flush, load])

  const needsLogin = ready && !session && !!supabase && loginRequired()
  return { records, ready, session, status, error, needsLogin, put, remove, flush, retry }
}
