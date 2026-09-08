import React, { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import useWorkspace from './useWorkspace.js'
const Editor = lazy(() => import('./Editor.jsx'))
import RecordBody from './RecordBody.jsx'
const Compare = lazy(() => import('./Compare.jsx'))
const Discussion = lazy(() => import('./Discussion.jsx'))
const Account = lazy(() => import('./Account.jsx'))
import { supabase } from './supabase.js'
import { newRecord, deriveRecord, snapshot, publicationProblems, fromRow, uid, today } from './domain.js'
import { listPublic, getPublic, getOwned, publishRecord, unpublishRecord, PAGE_SIZE } from './community.js'
import { Dialog, Empty, ErrorNotice, download } from './ui.jsx'
import SiteHeader, { NAV } from './SiteHeader.jsx'
import Catalog from './Catalog.jsx'
import PublicRecord from './PublicRecord.jsx'
import Icon from './Icon.jsx'
import useBookmarks from './useBookmarks.js'
import { EMPTY_FILTERS, filterRecord } from './search.js'
import { SEARCH_ENABLED } from './flags.js'
import './styles.css'
import './design.css'

const routeFromLocation = () => {
  const [view, id] = location.hash.replace(/^#\/?/, '').split('/')
  // 経営発表に一点集中する間、挑戦・学習ノートの専用ページは閉じる。
  return { view: ['mine', 'discover', 'saved', 'record', 'public', 'compare'].includes(view) ? view : 'discover', id }
}
const keyOf = r => `${r.publication ? 'public' : 'mine'}:${r.id}`
function App() {
  const workspace = useWorkspace()
  const { records, ready, session, status, error, put, remove, flush, retry } = workspace
  const [route, setRoute] = useState(routeFromLocation), [query, setQuery] = useState(''), [region, setRegion] = useState('')
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS }), [sort, setSort] = useState('recent')
  const [dialog, setDialog] = useState(null), [name, setName] = useState(() => { try { return localStorage.getItem('nitoron:name') || '' } catch { return '' } })
  const [selected, setSelected] = useState([]), [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState('')
  const [publicState, setPublicState] = useState({ records: [], count: 0, loading: true, error: '' })
  const [publicPage, setPublicPage] = useState(0), [refresh, setRefresh] = useState(0)
  const [publicRecord, setPublicRecord] = useState(null), [recordError, setRecordError] = useState('')
  const [owned, setOwned] = useState([]), [ownedReady, setOwnedReady] = useState(false)
  const [deviceRecords, setDeviceRecords] = useState([])
  const searchRef = useRef(null), importRef = useRef(null), nameTimer = useRef(null)
  const previousOwner = useRef(undefined)
  const bookmarks = useBookmarks(session, setToast, () => setDialog({ type: 'account' }))

  useEffect(() => { const change = () => { setRoute(routeFromLocation()); setQuery(''); setRegion(''); setFilters({ ...EMPTY_FILTERS }); setPublicPage(0); window.scrollTo(0, 0) }; window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change) }, [])
  useEffect(() => { if (!SEARCH_ENABLED) return; const keys = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!searchRef.current) { location.hash = '/mine'; setTimeout(() => searchRef.current?.focus(), 0) } else searchRef.current.focus() } }; window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys) }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t) }, [toast])
  useEffect(() => {
    if (previousOwner.current !== undefined && previousOwner.current !== session?.user.id) { setSelected([]); setDialog(null); setName('') }
    previousOwner.current = session?.user.id
    setOwned([]); setOwnedReady(false)
    if (!session?.user.id) return
    let cancelled = false
    getOwned(session.user.id).then(data => { if (!cancelled) { setOwned(data); setOwnedReady(true) } }).catch(() => { /* Public service errors appear on its own route. */ })
    supabase.from('settings').select('display_name').eq('user_id', session.user.id).maybeSingle().then(({ data }) => { if (!cancelled && data?.display_name) setName(data.display_name) })
    return () => { cancelled = true; clearTimeout(nameTimer.current) }
  }, [session?.user.id, refresh])
  useEffect(() => {
    if (!ready || !session) return
    try { const cached = JSON.parse(localStorage.getItem('nitoron:workspace:v1:device') || 'null'); setDeviceRecords(Array.isArray(cached?.records) ? cached.records : []) } catch { setDeviceRecords([]) }
  }, [ready, session?.user.id])
  useEffect(() => {
    if (!['discover', 'saved'].includes(route.view)) return
    if (route.view === 'saved' && !bookmarks.ready) return
    let cancelled = false
    setPublicState(s => ({ ...s, loading: true, error: '' }))
    const timer = setTimeout(() => listPublic({ query, region, page: publicPage, filters, sort, ...(route.view === 'saved' ? { bookmarkedBy: session?.user.id || null } : {}) }).then(data => { if (!cancelled) setPublicState({ ...data, loading: false, error: '' }) }).catch(e => { if (!cancelled) setPublicState({ records: [], count: 0, loading: false, error: e.message }) }), 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [route.view, query, region, publicPage, refresh, filters, sort, bookmarks.ready, bookmarks.ids.join(','), session?.user.id])
  useEffect(() => {
    if (route.view !== 'public') return
    let cancelled = false
    setPublicRecord(null); setRecordError('')
    getPublic(route.id).then(record => { if (!cancelled) setPublicRecord(record) }).catch(e => { if (!cancelled) setRecordError(e.message) })
    return () => { cancelled = true }
  }, [route.view, route.id, refresh])
  const editorRecord = records.find(r => r.id === route.id)
  useEffect(() => { document.title = `${route.view === 'record' && editorRecord ? editorRecord.title || '無題' : route.view === 'public' && publicRecord ? publicRecord.title : '4Hクラブの経営発表'} | Nitoron` }, [route.view, editorRecord?.title, publicRecord?.title])

  const rename = value => {
    setName(value); try { localStorage.setItem('nitoron:name', value) } catch { /* Server save remains available. */ }
    clearTimeout(nameTimer.current)
    if (session) nameTimer.current = setTimeout(async () => { const { error: nameError } = await supabase.from('settings').upsert({ user_id: session.user.id, display_name: value }); if (nameError) setToast('表示名の同期に失敗しました。') }, 600)
  }
  const create = (kind, source, feedback) => {
    if (!ready) return
    const record = source ? deriveRecord(source, kind, name) : newRecord(kind, name)
    if (feedback && record.meta) record.meta.learning = `${feedback.author}（${feedback.created_at.slice(0, 10)}）の${feedback.kind}：\n${feedback.body}\n\n自分の学び：\n`
    put(record); setDialog(null); location.hash = `/record/${record.id}`
  }
  const select = record => {
    if (selected.some(r => keyOf(r) === keyOf(record))) setSelected(selected.filter(r => keyOf(r) !== keyOf(record)))
    else if (selected.length < 3) setSelected([...selected, snapshotWithPublication(record)])
    else setToast('比較は3件までです。選択中の記録を外してから追加してください。')
  }
  const share = async record => {
    try { await getPublic(record.id) } catch (e) { setToast(e.message); return }
    try {
      const url = `${location.origin}${location.pathname}#/public/${record.id}`
      if (navigator.share) { await navigator.share({ title: record.title, url }); return }
      await navigator.clipboard.writeText(url); setToast('公開リンクをコピーしました。')
    } catch (e) { if (e.name !== 'AbortError') { setActionError(e.message || 'リンクを共有できませんでした。'); setDialog({ type: 'share', record }) } }
  }
  const publish = async () => {
    setBusy(true); setActionError('')
    try {
      if (!await flush()) throw new Error('下書きの保存を完了してから公開してください。')
      await publishRecord(dialog.record, session); setDialog(null); setRefresh(r => r + 1); setToast('公開しました。リンクから誰でも読めます。')
    } catch (e) { setActionError(e.message) } finally { setBusy(false) }
  }
  const stopPublication = async record => {
    if (!window.confirm('公開を停止しますか？ 共有リンクからも読めなくなります。指摘は保管されます。')) return
    try { await unpublishRecord(record.id, session.user.id); setRefresh(r => r + 1); setToast('公開を停止しました。') } catch (e) { setToast(e.message) }
  }
  const deleteRecord = async record => {
    // Re-read publication state before deleting; don't rely on a stale badge.
    try {
      if (session && record.meta) {
        const fresh = await getOwned(session.user.id)
        if (fresh.some(p => p.id === record.id && p.is_public)) throw new Error('先に公開を停止してください。')
      }
      await remove(record.id); setSelected(s => s.filter(r => r.id !== record.id)); location.hash = '/mine'; setToast('記録を削除しました。')
    } catch (e) { setToast(e.message); throw e }
  }
  const exportAll = () => download(`Nitoron_${today()}.json`, JSON.stringify({ format: 'nitoron-workspace', version: 1, exportedAt: new Date().toISOString(), records: records.map(snapshot) }, null, 2), 'application/json')
  const importBackup = async e => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('5MB以下のバックアップを選んでください。')
      const data = JSON.parse(await file.text())
      if (data.format !== 'nitoron-workspace' || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 500) throw new Error('Nitoronのバックアップファイルを選んでください（最大500件）。')
      if (!data.records.every(r => r && typeof r.title === 'string' && Array.isArray(r.blocks))) throw new Error('記録の形式を確認できませんでした。')
      if (!window.confirm(`${data.records.length}件を新しい記録として取り込みますか？ 既存の記録は残ります。`)) return
      for (const raw of data.records) put({ ...fromRow(raw), id: uid() })
      setToast(`${data.records.length}件を取り込みました。`)
    } catch (err) { setToast(err.message || '読み込めませんでした。') }
  }

  const publicMode = ['discover', 'saved'].includes(route.view)
  const list = publicMode ? publicState.records : records.filter(r => filterRecord(r, { query, region, filters }))
  const displayed = publicMode ? list : [...list].sort(sort === 'title' ? (a, b) => a.title.localeCompare(b.title, 'ja') : (a, b) => b.date.localeCompare(a.date))
  const selectedRecords = selected.map(r => r.publication ? r : records.find(x => x.id === r.id)).filter(Boolean)
  const nav = NAV
  return <div className="workspace">
    <a className="skip-link" href="#content" onClick={e => { e.preventDefault(); document.getElementById('content')?.focus() }}>本文へ移動</a>
    <SiteHeader view={route.view} name={name} ready={ready} selectedCount={selected.length} onCreate={() => create('presentation')} onAccount={() => setDialog({ type: 'account' })} />
    <main id="content" tabIndex={-1} className="main-content">
      {route.view === 'record' && <div className="save-bar print-hidden"><span role="status">{status}</span></div>}
      {error && <div className="workspace-error print-hidden"><ErrorNotice retry={retry}>{error}</ErrorNotice></div>}
      {route.view === 'record' ? ready ? editorRecord ? <Editor key={editorRecord.id} record={editorRecord} discussion={owned.some(p => p.id === editorRecord.id) && <Discussion record={{ ...editorRecord, publication: { owner: session?.user.id, isPublic: owned.find(p => p.id === editorRecord.id)?.is_public } }} session={session} name={name} onAccount={() => setDialog({ type: 'account' })} />} session={session} flush={flush} onChange={record => put(record, session?.user.id || null)} onPublish={() => { setActionError(''); setDialog({ type: 'publish', record: snapshot(editorRecord) }) }} onDelete={() => deleteRecord(editorRecord)} published={owned.some(p => p.id === editorRecord.id && p.is_public)} onUnpublish={() => stopPublication(editorRecord)} onShare={() => share(editorRecord)} /> : <Empty title="この記録は見つかりません" action={<a className="secondary" href="#/mine">自分の記録へ</a>}>保存したアカウントでログインしているか確認してください。</Empty> : <p className="loading" role="status">記録を読み込み中…</p>
      : route.view === 'public' ? recordError ? <div className="catalog"><ErrorNotice retry={() => setRefresh(r => r + 1)}>{recordError}</ErrorNotice><a href="#/discover">みんなの発表へ</a></div> : publicRecord ? <PublicRecord record={publicRecord} selected={selected.some(r => keyOf(r) === keyOf(publicRecord))} onSelect={() => select(publicRecord)} saved={bookmarks.ids.includes(publicRecord.id)} onSave={() => bookmarks.toggle(publicRecord)} onShare={() => share(publicRecord)} ready={ready} discussion={<Discussion key={publicRecord.id} record={publicRecord} session={session} name={name} onAccount={() => setDialog({ type: 'account' })} />} /> : <p className="loading" role="status">発表を読み込み中…</p>
      : route.view === 'compare' ? <Compare records={selectedRecords} onRemove={select} />
      : <Catalog view={route.view} records={displayed} total={publicMode ? publicState.count : displayed.length} loading={publicMode ? publicState.loading || route.view === 'saved' && !bookmarks.ready : !ready}
          error={route.view === 'saved' && bookmarks.error ? <ErrorNotice retry={bookmarks.retry}>{bookmarks.error}</ErrorNotice> : publicMode && publicState.error ? <ErrorNotice retry={() => setRefresh(r => r + 1)}>{publicState.error}</ErrorNotice> : null}
          query={query} onQuery={value => { setQuery(value); setPublicPage(0) }} region={region} onRegion={value => { setRegion(value); setPublicPage(0) }}
          filters={filters} onFilters={value => { setFilters(value); setPublicPage(0) }} sort={sort} onSort={value => { setSort(value); setPublicPage(0) }} savedIds={bookmarks.ids} onSave={bookmarks.toggle} searchRef={searchRef} keyOf={keyOf} selectedKeys={selected.map(keyOf)} onSelect={select}
          owned={owned} ownedReady={ownedReady} ready={ready} onCreate={() => create('presentation')}>
        {publicMode && publicState.count > PAGE_SIZE && <div className="pagination"><button className="secondary" disabled={publicPage === 0 || publicState.loading} onClick={() => setPublicPage(p => p - 1)}>前へ</button><span>{publicPage + 1} / {Math.ceil(publicState.count / PAGE_SIZE)}</span><button className="secondary" disabled={(publicPage + 1) * PAGE_SIZE >= publicState.count || publicState.loading} onClick={() => setPublicPage(p => p + 1)}>次へ</button></div>}
        {!publicMode && <footer className="catalog-footer">{!!deviceRecords.length && <button className="quiet" onClick={() => { if (window.confirm(`端末だけに保存した${deviceRecords.length}件を、このアカウントの新しい記録として取り込みますか？`)) { for (const r of deviceRecords) put({ ...fromRow(r), id: uid() }); setDeviceRecords([]); setToast('端末の記録を取り込みました。') } }}>端末だけの記録を復元</button>}<button className="quiet" disabled={!ready} onClick={exportAll}>全記録を書き出す</button><button className="quiet" disabled={!ready} onClick={() => importRef.current.click()}>バックアップを取り込む</button><input hidden type="file" ref={importRef} accept="application/json,.json" onChange={importBackup} /></footer>}
      </Catalog>}
    </main>
    {!!selected.length && route.view !== 'compare' && <div className="compare-tray print-hidden"><span>{selected.length}件を選択中</span><a href="#/compare">並べて比較する</a><button onClick={() => setSelected([])}>解除</button></div>}
    <nav className="mobile-nav print-hidden" aria-label="モバイルナビゲーション">{nav.map(([id, label, icon]) => <a key={id} href={`#/${id}`} aria-current={route.view === id || id === 'mine' && route.view === 'record' || id === 'discover' && route.view === 'public' ? 'page' : undefined}><Icon name={icon} size={23} /><span>{label}</span></a>)}<button onClick={() => setDialog({ type: 'account' })}><Icon name="user" size={23} /><span>アカウント</span></button></nav>
    {toast && <div className="toast print-hidden" role="status">{toast}</div>}
    {dialog?.type === 'account' && <Account session={session} name={name} onName={rename} flush={flush} onClose={() => setDialog(null)} />}
    {dialog?.type === 'publish' && <Dialog title="公開する内容を確認" wide onClose={busy ? () => {} : () => setDialog(null)}><p className="notice">以下の本文・名前・地域・数字・写真・添付資料・資料リンクが、ログインなしで誰でも読めるようになります。個人情報や他人の未公開情報が含まれていないか確認してください。</p>
      <div className="publish-preview"><RecordBody record={dialog.record} /></div>
      {publicationProblems(dialog.record).map(p => <p className="validation" key={p}>{p}</p>)}
      {actionError && <ErrorNotice>{actionError}</ErrorNotice>}
      <div className="dialog-actions">{session?.user.email_confirmed_at && !session.user.is_anonymous ? <button className="primary" disabled={busy || publicationProblems(dialog.record).length > 0} onClick={publish}>{busy ? '公開中…' : 'この内容で公開する'}</button> : <button className="primary" onClick={() => setDialog({ type: 'account' })}>メールを登録して公開</button>}</div>
    </Dialog>}
    {dialog?.type === 'share' && <Dialog title="公開リンク" onClose={() => setDialog(null)}><p>{actionError}</p><input aria-label="公開リンク" readOnly value={`${location.origin}${location.pathname}#/public/${dialog.record.id}`} onFocus={e => e.target.select()} /></Dialog>}
  </div>
}
function snapshotWithPublication(record) { return { ...snapshot(record), ...(record.publication ? { publication: record.publication } : {}) } }
class ErrorBoundary extends React.Component {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() { return this.state.error ? <div className="empty"><h1>画面を表示できませんでした</h1><p>保存済みの記録は削除していません。</p><button className="primary" onClick={() => location.reload()}>再読み込み</button></div> : this.props.children }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><Suspense fallback={<p className="loading" role="status">画面を準備しています…</p>}><App /></Suspense></ErrorBoundary>)
