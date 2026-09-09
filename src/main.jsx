import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import useWorkspace from './useWorkspace.js'
const Editor = lazy(() => import('./Editor.jsx'))
import RecordBody from './RecordBody.jsx'
const Compare = lazy(() => import('./Compare.jsx'))
const Discussion = lazy(() => import('./Discussion.jsx'))
const Account = lazy(() => import('./Account.jsx'))
const Talks = lazy(() => import('./Talks.jsx'))
import { supabase } from './supabase.js'
import { newRecord, deriveRecord, snapshot, publicationProblems, fromRow, uid, today, isBlankRecord } from './domain.js'
import { listPublic, getPublic, getOwned, publishRecord, unpublishRecord, PAGE_SIZE } from './community.js'
import { Dialog, Empty, ErrorNotice, download } from './ui.jsx'
import SiteHeader, { NAV, currentTab } from './SiteHeader.jsx'
import Catalog from './Catalog.jsx'
import Home from './Home.jsx'
import PublicRecord from './PublicRecord.jsx'
import Profile from './Profile.jsx'
const User = lazy(() => import('./User.jsx'))
const ProfileEdit = lazy(() => import('./ProfileEdit.jsx'))
import SavedList from './SavedList.jsx'
import Icon from './Icon.jsx'
import useBookmarks from './useBookmarks.js'
import useActivity from './useActivity.js'
import useFollows from './useFollows.js'
import CardMenu from './CardMenu.jsx'
import { EMPTY_FILTERS, filterRecord, listFromParams, paramsFromList } from './search.js'
import { SEARCH_ENABLED } from './flags.js'
import './styles.css'
import './design.css'

const routeFromLocation = () => {
  // 検索結果ページの条件は「#/search?q=…」のようにハッシュ内のクエリで持ち、URLを正とする。
  const [path, params = ''] = location.hash.replace(/^#\/?/, '').split('?')
  const [view, id, section] = path.split('/')
  // 経営発表に一点集中する間、挑戦・学習ノートの専用ページは閉じる。
  return { view: ['mine', 'discover', 'search', 'saved', 'record', 'public', 'compare', 'account', 'user', 'profile', 'talks'].includes(view) ? view : 'discover', id, section, params }
}
const keyOf = r => `${r.publication ? 'public' : 'mine'}:${r.id}`
// スクロール位置を覚えておく画面。詳細（public・record）は常に先頭から表示する。
const SCROLL_VIEWS = ['discover', 'search', 'saved', 'mine', 'talks', 'account', 'user', 'compare', 'profile']
const scrollKeyOf = r => SCROLL_VIEWS.includes(r.view) ? (r.view === 'user' ? `user:${r.id}` : r.view) : null
// 参照の同一性を保つため固定オブジェクトにする（毎回生成するとfiltersの同一性が崩れ、一覧取得のeffectがループする）。
const LIST_DEFAULTS = Object.freeze({ query: '', region: '', filters: EMPTY_FILTERS, sort: 'recent', page: 0 })
function App() {
  const workspace = useWorkspace()
  const { records, ready, session, status, error, needsLogin, put, remove, flush, retry } = workspace
  const [route, setRoute] = useState(routeFromLocation)
  const routeRef = useRef(route)
  routeRef.current = route
  // 一覧の検索語・地域・絞り込み・並び順・ページ番号を画面ごとに保持し、詳細から戻っても再入力させない。
  // 検索結果ページだけはURLを正とし、条件をハッシュのクエリから復元する。
  const [listStates, setListStates] = useState({})
  const isSearch = route.view === 'search'
  // filtersの参照同一性を保つためmemo化する（毎回生成すると一覧取得のeffectがループする）。
  const urlState = useMemo(() => isSearch ? listFromParams(route.params) : null, [isSearch, route.params])
  const { query, region, filters, sort, page: publicPage } = urlState || listStates[route.view] || LIST_DEFAULTS
  const patchList = patch => setListStates(s => ({ ...s, [route.view]: { ...(s[route.view] || LIST_DEFAULTS), ...patch } }))
  // 検索条件の変更はURLへ書く。入力中（push=false）は履歴を増やさず置き換え、
  // 検索確定・条件適用・ページ移動（push=true）だけを履歴の区切りにする。
  const goSearch = (patch, push) => {
    const qs = paramsFromList({ ...(urlState || LIST_DEFAULTS), ...patch })
    const target = `#/search${qs ? `?${qs}` : ''}`
    if (location.hash === target) return
    if (push) location.hash = target
    else { history.replaceState(history.state, '', target); setRoute(routeFromLocation()) }
  }
  const setQuery = value => isSearch ? goSearch({ query: value, page: 0 }, false) : patchList({ query: value, page: 0 })
  const setRegion = value => isSearch ? goSearch({ region: value, page: 0 }, false) : patchList({ region: value, page: 0 })
  const setFilters = value => isSearch ? goSearch({ filters: value, page: 0 }, true) : patchList({ filters: value, page: 0 })
  const setSort = value => isSearch ? goSearch({ sort: value, page: 0 }, true) : patchList({ sort: value, page: 0 })
  const setPublicPage = value => {
    const next = typeof value === 'function' ? value(publicPage) : value
    isSearch ? goSearch({ page: next }, true) : patchList({ page: next })
  }
  const resetSearch = () => isSearch ? goSearch({ ...LIST_DEFAULTS }, true) : patchList({ query: '', region: '', filters: { ...EMPTY_FILTERS }, page: 0 })
  const [dialog, setDialog] = useState(null), [name, setName] = useState(() => { try { return localStorage.getItem('nitoron:name') || '' } catch { return '' } })
  const [selected, setSelected] = useState([]), [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState('')
  const [publicState, setPublicState] = useState({ records: [], count: 0, loading: true, error: '' })
  const [refresh, setRefresh] = useState(0)
  const [publicRecord, setPublicRecord] = useState(null), [recordError, setRecordError] = useState('')
  const [owned, setOwned] = useState([]), [ownedReady, setOwnedReady] = useState(false)
  const [deviceRecords, setDeviceRecords] = useState([]), [draft, setDraft] = useState(null)
  const searchRef = useRef(null), importRef = useRef(null), nameTimer = useRef(null)
  const previousOwner = useRef(undefined)
  const bookmarks = useBookmarks(session, setToast, () => setDialog({ type: 'account' }))
  const activityItems = [...owned.filter(p => p.is_public).map(p => ({ id: p.id, since: p.updated_at })), ...bookmarks.rows.filter(b => !owned.some(p => p.id === b.id)).map(b => ({ id: b.id, since: b.savedAt }))]
  const activity = useActivity(session, activityItems)
  const [menuRecord, setMenuRecord] = useState(null)
  const accountFromMenu = () => { setMenuRecord(null); setDialog({ type: 'account' }) }
  const follows = useFollows(session, setToast, accountFromMenu)

  const scrollStore = useRef({}), pendingScroll = useRef(null), navigated = useRef(false)
  useEffect(() => {
    const change = () => {
      // 離れる画面のスクロール位置を保存し、戻り先に保存があれば復帰を予約する。条件はリセットしない。
      const prevKey = scrollKeyOf(routeRef.current)
      if (prevKey) scrollStore.current[prevKey] = window.scrollY
      navigated.current = true
      const next = routeFromLocation(), nextKey = scrollKeyOf(next)
      pendingScroll.current = nextKey && scrollStore.current[nextKey] != null ? { key: nextKey, y: scrollStore.current[nextKey] } : null
      if (!pendingScroll.current) window.scrollTo(0, 0)
      setRoute(next)
    }
    window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change)
  }, [])
  // 一覧へ戻ったら、内容の読み込みを待ってから元の位置へスクロールを復帰する。利用者が操作したら中断する。
  useEffect(() => {
    const target = pendingScroll.current
    if (!target || target.key !== scrollKeyOf(route)) return
    pendingScroll.current = null
    let stop = false, timer = null, tries = 25
    const cancel = () => { stop = true }
    const attempt = () => {
      if (stop) return
      window.scrollTo(0, target.y)
      if (Math.abs(window.scrollY - target.y) > 2 && --tries > 0) timer = setTimeout(attempt, 80)
    }
    attempt()
    window.addEventListener('wheel', cancel, { once: true, passive: true })
    window.addEventListener('touchstart', cancel, { once: true, passive: true })
    return () => { stop = true; clearTimeout(timer); window.removeEventListener('wheel', cancel); window.removeEventListener('touchstart', cancel) }
  }, [route.view, route.id, route.params])
  // 直接URLで詳細を開いたなど、アプリ内の戻り先がないときは「探す」へ戻す。
  const backToList = () => { if (navigated.current) history.back(); else location.hash = '/discover' }
  useEffect(() => { if (!SEARCH_ENABLED) return; const keys = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!searchRef.current) { location.hash = '/discover'; setTimeout(() => searchRef.current?.focus(), 0) } else searchRef.current.focus() } }; window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys) }, [])
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
    if (!['search', 'saved'].includes(route.view)) return
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
  // Opening a publication's page (or its editor with the discussion) counts as reading its feedback.
  useEffect(() => {
    const id = route.view === 'public' ? publicRecord?.id : route.view === 'record' ? route.id : null
    if (id) activity.markSeen(id)
  }, [route.view, route.id, publicRecord?.id, activityItems.map(i => i.id).join(',')])
  // カードメニューの「質問・指摘を送る」から来たときは、読み込み後に対話欄まで送る。
  useEffect(() => {
    if (route.view !== 'public' || route.section !== 'discussion' || !publicRecord) return
    const timer = setTimeout(() => document.getElementById('discussion')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120)
    return () => clearTimeout(timer)
  }, [route.view, route.section, publicRecord])
  // 一覧の切り替えやログアウト後に、開いていたカードメニューを残さない。
  useEffect(() => { setMenuRecord(null) }, [route.view, route.id, session?.user.id])
  const editorRecord = records.find(r => r.id === route.id) || (draft && draft.id === route.id ? draft : undefined)
  // 一度も入力しなかった下書きは、記録ページを離れた時点で破棄する。
  useEffect(() => { setDraft(d => d && (route.view !== 'record' || route.id !== d.id) ? null : d) }, [route.view, route.id])
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
    // 白紙の新規作成は最初の入力まで保存しない。元記録から引き継ぐ場合は内容があるので保存する。
    if (source) put(record)
    else setDraft(record)
    setDialog(null); location.hash = `/record/${record.id}`
  }
  const cleanupBlankRecords = async () => {
    const blanks = records.filter(r => isBlankRecord(r) && !owned.some(p => p.id === r.id && p.is_public))
    if (!blanks.length || !window.confirm(`何も書いていない空の記録${blanks.length}件を削除しますか？ 元に戻せません。`)) return
    try {
      for (const r of blanks) await remove(r.id)
      setSelected(s => s.filter(x => !blanks.some(b => b.id === x.id)))
      setToast(`空の記録を${blanks.length}件削除しました。`)
    } catch (e) { setToast(e.message || '空の記録を削除できませんでした。') }
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

  const publicMode = route.view === 'search'
  const list = publicMode ? publicState.records : records.filter(r => filterRecord(r, { query, region, filters }))
  const displayed = publicMode ? list : [...list].sort(sort === 'title' ? (a, b) => a.title.localeCompare(b.title, 'ja') : (a, b) => b.date.localeCompare(a.date))
  const selectedRecords = selected.map(r => r.publication ? r : records.find(x => x.id === r.id)).filter(Boolean)
  return <div className="workspace">
    <a className="skip-link" href="#content" onClick={e => { e.preventDefault(); document.getElementById('content')?.focus() }}>本文へ移動</a>
    <SiteHeader view={route.view} name={name} notify={activity.total > 0} />
    <main id="content" tabIndex={-1} className="main-content">
      {route.view === 'record' && <div className="save-bar print-hidden"><span role="status">{draft && route.id === draft.id && !records.some(r => r.id === draft.id) ? '未保存の下書き · 書き始めると自動保存します' : status}</span></div>}
      {error && <div className="workspace-error print-hidden"><ErrorNotice retry={retry}>{error}</ErrorNotice></div>}
      {!error && needsLogin && ['mine', 'record'].includes(route.view) && <div className="workspace-error print-hidden"><div className="notice" role="status"><span>記録はこの端末に保存しています。登録・ログインするとクラウドに保存し、公開や指摘ができます。</span> <button onClick={() => setDialog({ type: 'account' })}>登録・ログイン</button></div></div>}
      {route.view === 'record' ? ready ? editorRecord ? <Editor key={editorRecord.id} record={editorRecord} discussion={owned.some(p => p.id === editorRecord.id) && <Discussion record={{ ...editorRecord, publication: { owner: session?.user.id, isPublic: owned.find(p => p.id === editorRecord.id)?.is_public } }} session={session} name={name} onAccount={() => setDialog({ type: 'account' })} />} session={session} flush={flush} onChange={record => put(record, session?.user.id || null)} onPublish={() => { setActionError(''); setDialog({ type: 'publish', record: snapshot(editorRecord) }) }} onDelete={() => deleteRecord(editorRecord)} published={owned.some(p => p.id === editorRecord.id && p.is_public)} onUnpublish={() => stopPublication(editorRecord)} onShare={() => share(editorRecord)} /> : <Empty title="この記録は見つかりません" action={<a className="secondary" href="#/mine">自分の実践へ</a>}>保存したアカウントでログインしているか確認してください。</Empty> : <p className="loading" role="status">記録を読み込み中…</p>
      : route.view === 'public' ? recordError ? <div className="catalog"><ErrorNotice retry={() => setRefresh(r => r + 1)}>{recordError}</ErrorNotice><a href="#/discover">みんなの発表へ</a></div> : publicRecord ? <PublicRecord record={publicRecord} onBack={backToList} selected={selected.some(r => keyOf(r) === keyOf(publicRecord))} onSelect={() => select(publicRecord)} saved={bookmarks.ids.includes(publicRecord.id)} onSave={() => bookmarks.toggle(publicRecord)} onShare={() => share(publicRecord)} ready={ready} discussion={<Discussion key={publicRecord.id} record={publicRecord} session={session} name={name} onAccount={() => setDialog({ type: 'account' })} />} /> : <p className="loading" role="status">発表を読み込み中…</p>
      : route.view === 'talks' ? <Talks session={session} bookmarks={bookmarks} onAccount={() => setDialog({ type: 'account' })} />
      : route.view === 'compare' ? <Compare records={selectedRecords} onRemove={select} />
      : route.view === 'account' ? <Profile session={session} name={name} selectedCount={selected.length} onAccount={() => setDialog({ type: 'account' })}
          savedNew={bookmarks.rows.reduce((n, b) => n + (activity.counts[b.id] || 0), 0)} mineNew={owned.reduce((n, p) => n + (activity.counts[p.id] || 0), 0)} />
      : route.view === 'user' ? <User key={route.id} id={route.id} savedIds={bookmarks.ids} onSave={bookmarks.toggle} onMenu={setMenuRecord} selectedKeys={selected.map(keyOf)} keyOf={keyOf} onSelect={select} />
      : route.view === 'profile' ? <ProfileEdit session={session} name={name} onName={rename} onAccount={() => setDialog({ type: 'account' })} />
      : route.view === 'discover' ? <Home savedIds={bookmarks.ids} onSave={bookmarks.toggle} onMenu={setMenuRecord} keyOf={keyOf} selectedKeys={selected.map(keyOf)} onSelect={select} searchRef={searchRef} />
      : route.view === 'saved' ? <SavedList session={session} records={publicState.records} count={publicState.count} loading={publicState.loading || !bookmarks.ready}
          error={bookmarks.error ? <ErrorNotice retry={bookmarks.retry}>{bookmarks.error}</ErrorNotice> : publicState.error ? <ErrorNotice retry={() => setRefresh(r => r + 1)}>{publicState.error}</ErrorNotice> : null}
          page={publicPage} onPage={setPublicPage} savedIds={bookmarks.ids} onSave={bookmarks.toggle} onMenu={setMenuRecord} activityCounts={activity.counts} keyOf={keyOf} selectedKeys={selected.map(keyOf)} onSelect={select} onAccount={() => setDialog({ type: 'account' })} />
      : <Catalog view={route.view} records={displayed} total={publicMode ? publicState.count : displayed.length} loading={publicMode ? publicState.loading : !ready}
          error={publicMode && publicState.error ? <ErrorNotice retry={() => setRefresh(r => r + 1)}>{publicState.error}</ErrorNotice> : null}
          query={query} onQuery={setQuery} region={region} onRegion={setRegion}
          filters={filters} onFilters={setFilters} sort={sort} onSort={setSort} onReset={resetSearch} savedIds={bookmarks.ids} onSave={bookmarks.toggle} onMenu={setMenuRecord} activityCounts={activity.counts} searchRef={searchRef} keyOf={keyOf} selectedKeys={selected.map(keyOf)} onSelect={select}
          owned={owned} ownedReady={ownedReady} ready={ready} onCreate={() => create('presentation')}
          blankCount={publicMode ? 0 : records.filter(r => isBlankRecord(r) && !owned.some(p => p.id === r.id && p.is_public)).length} onCleanup={cleanupBlankRecords}>
        {publicMode && publicState.count > PAGE_SIZE && <div className="pagination"><button className="secondary" disabled={publicPage === 0 || publicState.loading} onClick={() => setPublicPage(p => p - 1)}>前へ</button><span>{publicPage + 1} / {Math.ceil(publicState.count / PAGE_SIZE)}</span><button className="secondary" disabled={(publicPage + 1) * PAGE_SIZE >= publicState.count || publicState.loading} onClick={() => setPublicPage(p => p + 1)}>次へ</button></div>}
        {!publicMode && <footer className="catalog-footer">{!!deviceRecords.length && <button className="quiet" onClick={() => { if (window.confirm(`端末だけに保存した${deviceRecords.length}件を、このアカウントの新しい記録として取り込みますか？`)) { for (const r of deviceRecords) put({ ...fromRow(r), id: uid() }); setDeviceRecords([]); setToast('端末の記録を取り込みました。') } }}>端末だけの記録を復元</button>}<button className="quiet" disabled={!ready} onClick={exportAll}>全記録を書き出す</button><button className="quiet" disabled={!ready} onClick={() => importRef.current.click()}>バックアップを取り込む</button><input hidden type="file" ref={importRef} accept="application/json,.json" onChange={importBackup} /></footer>}
      </Catalog>}
    </main>
    {!!selected.length && route.view !== 'compare' && <div className="compare-tray print-hidden"><span>{selected.length}件を選択中</span><a href="#/compare">並べて比較する</a><button onClick={() => setSelected([])}>解除</button></div>}
    <nav className="mobile-nav print-hidden" aria-label="モバイルナビゲーション">{NAV.map(([id, label, icon]) => <a key={id} href={`#/${id}`} aria-current={currentTab(id, route.view) ? 'page' : undefined} aria-label={id === 'talks' && activity.total > 0 ? '対話（新着の指摘あり）' : undefined}><span className="nav-icon">{id === 'talks' && activity.total > 0 && <i className="notify-dot" aria-hidden="true" />}<Icon name={icon} size={23} /></span><span>{label}</span></a>)}</nav>
    {toast && <div className="toast print-hidden" role="status">{toast}</div>}
    {menuRecord && <CardMenu key={menuRecord.id} record={menuRecord} session={session} saved={bookmarks.ids.includes(menuRecord.id)}
      onSave={() => session ? bookmarks.toggle(menuRecord) : accountFromMenu()}
      following={follows.ids.includes(menuRecord.publication?.owner)} onFollow={() => follows.toggle(menuRecord.publication?.owner, menuRecord.meta?.author || '発表者')}
      onClose={() => setMenuRecord(null)} onAccount={accountFromMenu} notify={setToast} />}
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
