import { useEffect, useRef, useState } from 'react'
import { listBookmarks, setBookmark } from './community.js'
export default function useBookmarks(session, notify, onAccount) {
  const owner = session?.user.id
  const [state, setState] = useState({ owner: null, rows: [], ready: false, error: '' }), [version, setVersion] = useState(0)
  const pending = useRef(new Set()), currentOwner = useRef(owner)
  currentOwner.current = owner
  useEffect(() => {
    let active = true
    if (!owner) { setState({ owner, rows: [], ready: true, error: '' }); return }
    setState({ owner, rows: [], ready: false, error: '' })
    listBookmarks(owner).then(rows => { if (active) setState({ owner, rows, ready: true, error: '' }) }).catch(e => { if (active) setState({ owner, rows: [], ready: true, error: e.message }) })
    return () => { active = false }
  }, [owner, version])
  const rows = state.owner === owner ? state.rows : []
  const ids = rows.map(r => r.id)
  const toggle = async record => {
    if (!owner) { onAccount(); return }
    if (state.error) { notify(state.error); return }
    const key = `${owner}:${record.id}`
    if (!state.ready || pending.current.has(key)) return
    pending.current.add(key)
    const saved = !ids.includes(record.id)
    try {
      await setBookmark(owner, record.id, saved)
      if (currentOwner.current === owner) { setState(s => ({ ...s, rows: saved ? [...s.rows.filter(r => r.id !== record.id), { id: record.id, savedAt: new Date().toISOString() }] : s.rows.filter(r => r.id !== record.id) })); notify(saved ? '保存リストに追加しました。' : '保存リストから外しました。') }
    } catch (e) { if (currentOwner.current === owner) notify(e.message) }
    finally { pending.current.delete(key) }
  }
  return { ids, rows, ready: state.owner === owner && state.ready, error: state.owner === owner ? state.error : '', toggle, retry: () => setVersion(v => v + 1) }
}
