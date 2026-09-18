import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import useWorkspace from './useWorkspace.js'
const RepairWorkspace = lazy(() => import('./RepairWorkspace.jsx').then(module => ({ default: module.RepairHome })))
const RepairDetail = lazy(() => import('./RepairWorkspace.jsx').then(module => ({ default: module.RepairDetail })))
import { isRepairRecord, newFreeRepairRecord } from './repair-workspace.mjs'
const Editor = lazy(() => import('./Editor.jsx'))
const ListingFlow = lazy(() => import('./ListingFlow.jsx'))
import { LISTING_STEPS, listingStepKey, resolveListingStep } from './listing-flow.js'
const Compare = lazy(() => import('./Compare.jsx'))
const Discussion = lazy(() => import('./Discussion.jsx'))
const Account = lazy(() => import('./Account.jsx'))
const Talks = lazy(() => import('./Talks.jsx'))
import { supabase } from './supabase.js'
import PrivateAccess from './PrivateAccess.jsx'
import { newRecord, snapshot, publicSnapshot, publicationKey, fromRow, uid, today, isBlankRecord } from './domain.js'
import { listPublic, getPublic, getOwned, getOwnPublication, publishRecord, unpublishRecord, PAGE_SIZE } from './community.js'
import { Dialog, Empty, ErrorNotice, download } from './ui.jsx'
import SiteHeader, { NAV, currentTab } from './SiteHeader.jsx'
import useScrollChrome from './scroll-chrome.js'
import Catalog from './Catalog.jsx'
import PublicRecord from './PublicRecord.jsx'
import ManualPage from './ManualPage.jsx'
const User = lazy(() => import('./User.jsx'))
const AccountPage = lazy(() => import('./AccountPage.jsx'))
import SavedList from './SavedList.jsx'
const SharedList = lazy(() => import('./SharedList.jsx'))
import SaveSheet from './SaveSheet.jsx'
import useLists from './useLists.js'
import Icon from './Icon.jsx'
import useBookmarks from './useBookmarks.js'
import useActivity from './useActivity.js'
import useFollows from './useFollows.js'
import { EMPTY_FILTERS, filterRecord, listFromParams, paramsFromList } from './search.js'
import { SEARCH_ENABLED } from './flags.js'
import './styles.css'
import './design.css'
import './browse-experience.css'
import './header-experience.css'
import './detail-experience.css'
import './listing-flow.css'
import { isDiscoveryHome } from './discovery-domain.js'

const routeFromLocation = () => {
  if (/^#\/?profile(\/|$)/.test(location.hash)) location.hash = '/account/personal'
  // 旧「#/search?…」は探す（#/discover?…）へクエリごと転送する。
  if (/^#\/?search(\?|$)/.test(location.hash)) location.hash = location.hash.replace(/^#\/?search/, '/discover')
  // 探すの条件は「#/discover?q=…」のようにハッシュ内のクエリで持ち、URLを正とする。
  const [path, params = ''] = location.hash.replace(/^#\/?/, '').split('?')
  const [view, id, section, extra] = path.split('/')
  // 経営発表に一点集中する間、挑戦・学習ノートの専用ページは閉じる。extra は「#/public/:id/manual/:pdf」の頁番号。
  return { view: ['mine', 'discover', 'saved', 'list', 'record', 'public', 'compare', 'account', 'user', 'talks', 'repairs', 'repair', 'listing'].includes(view) ? view : 'discover', id, section, extra, params }
}
const keyOf = r => `${r.publication ? 'public' : 'mine'}:${r.id}`
// スクロール位置を覚えておく画面。詳細（public・record）は常に先頭から表示する。
const SCROLL_VIEWS = ['discover', 'saved', 'list', 'mine', 'talks', 'account', 'user', 'compare', 'repairs']
// 保存リストは「一覧」「すべて」「各リスト」を別の画面として扱い、条件・ページ・スクロール位置をそれぞれ保持する。
const listKeyOf = r => r.view === 'saved' ? `saved:${r.id || ''}` : r.view
// 探すは条件ごとに別のキー（詳細から戻ると同じ条件の位置へ復帰し、チップ・ページ送りは先頭から）。
const scrollKeyOf = r => SCROLL_VIEWS.includes(r.view) ? (['user', 'list'].includes(r.view) ? `${r.view}:${r.id}` : r.view === 'discover' ? `discover?${r.params}` : listKeyOf(r)) : null
// 比較の選択はID・種別・順序だけを sessionStorage に持ち、本文は再読込のたびに取り直す。
const COMPARE_KEY = 'nitoron:compare:v1'
// 編集の段階（基本情報→内容・資料→確認・公開）。段階の位置は利用者・記録ごとに端末へ持ち、本文の保存とは別に管理する。
const STEP_KEYS = ['basics', 'content', 'review']
const stepStorageKey = (owner, id) => `nitoron:record-step:v1:${owner || 'device'}:${id}`
// 参照の同一性を保つため固定オブジェクトにする（毎回生成するとfiltersの同一性が崩れ、一覧取得のeffectがループする）。
const LIST_DEFAULTS = Object.freeze({ query: '', region: '', filters: EMPTY_FILTERS, sort: 'recent', page: 0 })
function App({ verifiedSession }) {
  const workspace = useWorkspace(verifiedSession)
  const { records, ready, session, status, error, needsLogin, sync, put, remove, flush, retry } = workspace
  const recordsRef = useRef(records)
  recordsRef.current = records
  const [route, setRoute] = useState(routeFromLocation)
  const routeRef = useRef(route)
  routeRef.current = route
  // 自分の実践・保存リストの検索語・絞り込み・並び順・ページ番号は画面ごとに保持し、詳細から戻っても再入力させない。
  // 探す（#/discover）だけはURLを正とし、条件をハッシュのクエリから復元する。
  const [listStates, setListStates] = useState({})
  const isDiscover = route.view === 'discover'
  // filtersの参照同一性を保つためmemo化する（毎回生成すると一覧取得のeffectがループする）。
  const urlState = useMemo(() => isDiscover ? listFromParams(route.params) : null, [isDiscover, route.params])
  const listKey = listKeyOf(route)
  const { query, region, filters, sort, page: publicPage } = urlState || listStates[listKey] || LIST_DEFAULTS
  const patchList = patch => setListStates(s => ({ ...s, [listKey]: { ...(s[listKey] || LIST_DEFAULTS), ...patch } }))
  // 検索条件の変更はURLへ書く。入力中（push=false）は履歴を増やさず置き換え、
  // 検索確定・条件適用・ページ移動（push=true）だけを履歴の区切りにする。
  const goDiscover = (patch, push) => {
    const qs = paramsFromList({ ...(urlState || LIST_DEFAULTS), ...patch })
    const target = `#/discover${qs ? `?${qs}` : ''}`
    if (location.hash === target) return
    if (push) location.hash = target
    else { history.replaceState(history.state, '', target); setRoute(routeFromLocation()) }
  }
  const setQuery = value => isDiscover ? goDiscover({ query: value, page: 0 }, false) : patchList({ query: value, page: 0 })
  const setRegion = value => isDiscover ? goDiscover({ region: value, page: 0 }, false) : patchList({ region: value, page: 0 })
  const setFilters = value => isDiscover ? goDiscover({ filters: value, page: 0 }, true) : patchList({ filters: value, page: 0 })
  const setSort = value => isDiscover ? goDiscover({ sort: value, page: 0 }, true) : patchList({ sort: value, page: 0 })
  const setPublicPage = value => {
    const next = typeof value === 'function' ? value(publicPage) : value
    isDiscover ? goDiscover({ page: next }, true) : patchList({ page: next })
  }
  const resetSearch = () => isDiscover ? goDiscover({ ...LIST_DEFAULTS }, true) : patchList({ query: '', region: '', filters: { ...EMPTY_FILTERS }, page: 0 })
  const [dialog, setDialog] = useState(null), [name, setName] = useState(() => { try { return localStorage.getItem('nitoron:name') || '' } catch { return '' } })
  const [selected, setSelected] = useState([]), [toast, setToast] = useState('')
  const [actionError, setActionError] = useState('')
  const [publicState, setPublicState] = useState({ records: [], count: 0, loading: true, error: '' })
  const [refresh, setRefresh] = useState(0)
  const [publicRecord, setPublicRecord] = useState(null), [recordError, setRecordError] = useState('')
  const [owned, setOwned] = useState([]), [ownedReady, setOwnedReady] = useState(false)
  const [deviceRecords, setDeviceRecords] = useState([]), [draft, setDraft] = useState(null)
  const searchRef = useRef(null), nameTimer = useRef(null)
  // ヘッダー・下部ナビの出し入れ（スクロール方向）と、畳まれた検索ピルを押して開いた状態。
  const liveChrome = useScrollChrome()
  const [searchOpen, setSearchOpen] = useState(false)
  // 押して開いた検索ピルに入力している間は、入力ごとの URL 更新・一覧の読み直しで起きるスクロールの揺れでヘッダーが畳まれたり隠れたりしないよう、開いた時点の状態を保つ。
  const frozenChrome = useRef(null)
  if (!searchOpen) frozenChrome.current = null
  else if (!frozenChrome.current) frozenChrome.current = liveChrome
  const chrome = frozenChrome.current || liveChrome
  const previousOwner = useRef(undefined)
  // 保存の通知：未保存からの保存は「リストに追加」の操作つきで知らせる。
  const [sheetRecord, setSheetRecord] = useState(null), [picking, setPicking] = useState(false)
  const notifySave = (text, record) => setToast(record ? { text, action: { label: 'リストに追加', run: () => setSheetRecord(record) } } : text)
  const bookmarks = useBookmarks(session, notifySave, () => setDialog({ type: 'account' }))
  const lists = useLists(session, bookmarks.ids, setToast)
  const activityItems = [...owned.filter(p => p.is_public).map(p => ({ id: p.id, since: p.updated_at })), ...bookmarks.rows.filter(b => !owned.some(p => p.id === b.id)).map(b => ({ id: b.id, since: b.savedAt }))]
  const activity = useActivity(session, activityItems)
  const openAccount = () => setDialog({ type: 'account' })
  // ハートの統一動作：未ログインは案内、未保存は即保存（＋リストに追加の案内）、保存済みは保存先シート。
  const heart = record => { if (!session) return openAccount(); if (bookmarks.ids.includes(record.id)) setSheetRecord(record); else bookmarks.toggle(record) }
  const follows = useFollows(session, setToast, openAccount)
  const publishLock = useRef(false)
  const [publishing, setPublishing] = useState(false)
  const [ownPublication, setOwnPublication] = useState({ loading: false, error: '', row: null })

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
  const backFromCompare = () => { if (navigated.current) history.back(); else location.hash = '/saved' }
  useEffect(() => { setSheetRecord(null); setPicking(false) }, [route.view, route.id, session?.user.id])
  // 記録の段階：URLの段階指定を優先し、なければ最後に開いた段階（端末保存）へ。段階を開くたびに位置を記録する。
  useEffect(() => {
    if (route.view !== 'record' || !route.id || !ready) return
    if (route.section === 'review') { history.replaceState(history.state, '', `#/listing/${route.id}/review`); setRoute(routeFromLocation()); return }
    const key = stepStorageKey(session?.user.id, route.id)
    if (STEP_KEYS.includes(route.section)) { try { localStorage.setItem(key, route.section) } catch { /* 位置は任意 */ } return }
    let last = null
    try { last = localStorage.getItem(key) } catch { last = null }
    const current = recordsRef.current.find(r => r.id === route.id)
    const step = STEP_KEYS.includes(last) ? last : current && current.title.trim() ? 'content' : 'basics'
    history.replaceState(history.state, '', `#/record/${route.id}/${step}`); setRoute(routeFromLocation())
  }, [route.view, route.id, route.section, ready, session?.user.id])
  // Listing progress belongs to the account and record. The URL wins over a saved position.
  useEffect(() => {
    if (route.view !== 'listing' || !route.id || !ready) return
    const key = listingStepKey(session?.user.id, route.id)
    let saved = null
    try { saved = localStorage.getItem(key) } catch { /* Progress is optional. */ }
    const step = resolveListingStep(route.section, saved)
    if (LISTING_STEPS.includes(route.section)) { try { localStorage.setItem(key, step) } catch { /* Draft storage reports its own failures. */ } }
    else { history.replaceState(history.state, '', `#/listing/${route.id}/${step}`); setRoute(routeFromLocation()) }
  }, [route.view, route.id, route.section, ready, session?.user.id])
  // 公開版（本人の snapshot）を取得し、「公開版と異なる変更」の比較に使う。取得失敗は「変更なし」と見せない。
  const publishedNow = ['record', 'repair', 'listing'].includes(route.view) && owned.some(p => p.id === route.id && p.is_public)
  useEffect(() => {
    if (!publishedNow || !session) { setOwnPublication({ loading: false, error: '', row: null }); return }
    let cancelled = false
    setOwnPublication({ loading: true, error: '', row: null })
    getOwnPublication(route.id, session.user.id).then(row => { if (!cancelled) setOwnPublication({ loading: false, error: '', row }) }).catch(e => { if (!cancelled) setOwnPublication({ loading: false, error: e.message, row: null }) })
    return () => { cancelled = true }
  }, [publishedNow, route.id, session?.user.id, refresh])
  useEffect(() => { if (!SEARCH_ENABLED) return; const keys = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!searchRef.current) { setSearchOpen(true); location.hash = '/discover'; setTimeout(() => searchRef.current?.focus(), 0) } else { setSearchOpen(true); setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0) } } }; window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys) }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t) }, [toast])
  useEffect(() => {
    if (previousOwner.current !== undefined && previousOwner.current !== session?.user.id) { setSelected([]); setDialog(null); setName(''); try { sessionStorage.removeItem(COMPARE_KEY) } catch { /* 保持なし */ } }
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
  // 比較の復元：同じ利用者の選択だけを、公開中の発表・本人の記録から取り直す。公開停止・削除・別利用者の分は捨てる。
  const compareHydrated = useRef(false)
  useEffect(() => {
    if (!ready) return
    compareHydrated.current = false
    let cancelled = false
    const owner = session?.user.id || null
    ;(async () => {
      let saved = null
      try { saved = JSON.parse(sessionStorage.getItem(COMPARE_KEY) || 'null') } catch { saved = null }
      const items = saved && saved.owner === owner && Array.isArray(saved.items) ? saved.items.slice(0, 3) : []
      const results = []
      for (const item of items) {
        if (item.kind === 'mine') { const r = records.find(x => x.id === item.id); if (r) results.push(snapshotWithPublication(r)) }
        else if (item.kind === 'public') { try { results.push(snapshotWithPublication(await getPublic(item.id))) } catch { /* 公開停止・削除は除外 */ } }
      }
      if (cancelled) return
      setSelected(results); compareHydrated.current = true
    })()
    return () => { cancelled = true }
  }, [ready, session?.user.id])
  useEffect(() => {
    if (!compareHydrated.current) return
    try { sessionStorage.setItem(COMPARE_KEY, JSON.stringify({ owner: session?.user.id || null, items: selected.map(r => ({ id: r.id, kind: r.publication ? 'public' : 'mine' })) })) } catch { /* 保持できなくても比較は使える */ }
  }, [selected, session?.user.id])
  useEffect(() => {
    if (!['discover', 'saved'].includes(route.view)) return
    if (route.view === 'saved' && !bookmarks.ready) return
    if (route.view === 'discover' && isDiscoveryHome({ query, region, page: publicPage, filters, sort })) return
    let cancelled = false
    setPublicState(s => ({ ...s, loading: true, error: '' }))
    // 保存リスト：一覧と「すべて」は本人の bookmark、名前付きリストは所属で絞る。
    const scope = route.view !== 'saved' ? {} : route.id && route.id !== 'all' ? { listId: route.id } : { bookmarkedBy: session?.user.id || null }
    const timer = setTimeout(() => listPublic({ query, region, page: publicPage, filters, sort, ...scope }).then(data => { if (!cancelled) setPublicState({ ...data, loading: false, error: '' }) }).catch(e => { if (!cancelled) setPublicState({ records: [], count: 0, loading: false, error: e.message }) }), 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [route.view, route.id, query, region, publicPage, refresh, filters, sort, bookmarks.ready, bookmarks.ids.join(','), lists.items.length, session?.user.id])
  useEffect(() => {
    if (route.view !== 'public') return
    let cancelled = false
    setPublicRecord(null); setRecordError('')
    getPublic(route.id).then(record => { if (!cancelled) setPublicRecord(record) }).catch(e => { if (!cancelled) setRecordError(e.message) })
    return () => { cancelled = true }
  }, [route.view, route.id, refresh])
  // 既読は対話欄が表示され、投稿を取得した時点で Discussion から通知される（発表の上部を開いただけでは既読にしない）。
  // カードメニューの「質問・指摘を送る」から来たときは、読み込み後に対話欄まで送る。
  useEffect(() => {
    if (route.view !== 'public' || route.section !== 'discussion' || !publicRecord) return
    const timer = setTimeout(() => document.getElementById('discussion')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120)
    return () => clearTimeout(timer)
  }, [route.view, route.section, publicRecord])
  const editorRecord = records.find(r => r.id === route.id) || (draft && draft.id === route.id ? draft : undefined)
  const repairView = ['repairs', 'repair'].includes(route.view) || route.view === 'record' && isRepairRecord(editorRecord) || route.view === 'public' && isRepairRecord(publicRecord)
  // ナビの点灯用：編集中の記録が修理記録なら「修理記録」タブ。公開ページの修理記録は「探す」側のまま。
  const navView = route.view === 'record' && isRepairRecord(editorRecord) ? 'repair' : route.view
  const repairSave = { status, error: sync.cacheFailed ? '端末に保存できません。' : '', cloudError: error, retry, sync, session }
  const openRepair = record => { if (!put(record, session?.user.id || null)) return false; location.hash = `/repair/${record.id}`; return true }
  // 探すの0件から：入力した型式をそのまま3Dなしの修理記録にして開く（登録機種を推測しない）。
  const startRepair = text => { if (!openRepair(newFreeRepairRecord(text))) setToast('保存できません。もう一度お試しください。') }
  // 新しい修理記録シート（#/repairs/new）を閉じるときは履歴を増やさず #/repairs に置き換える。
  const closeRepairSheet = () => { history.replaceState(history.state, '', '#/repairs'); setRoute(routeFromLocation()) }
  // 一度も入力しなかった下書きは、記録ページを離れた時点で破棄する。
  useEffect(() => { setDraft(d => d && (!['record', 'listing'].includes(route.view) || route.id !== d.id) ? null : d) }, [route.view, route.id])
  useEffect(() => { document.title = `${['record', 'repair', 'listing'].includes(route.view) && editorRecord ? editorRecord.title || '無題' : route.view === 'public' && publicRecord ? publicRecord.title : route.view === 'repairs' ? '修理記録' : '機械の修理記録'} | Nitoron` }, [route.view, editorRecord?.title, publicRecord?.title])

  const rename = value => {
    setName(value); try { localStorage.setItem('nitoron:name', value) } catch { /* Server save remains available. */ }
    clearTimeout(nameTimer.current)
    if (session) nameTimer.current = setTimeout(async () => { const { error: nameError } = await supabase.from('settings').upsert({ user_id: session.user.id, display_name: value }); if (nameError) setToast('表示名の同期に失敗しました。') }, 600)
  }
  const create = kind => {
    if (!ready) return
    // 白紙の新規作成は最初の入力まで保存しない。
    const record = newRecord(kind, name)
    setDraft(record)
    setDialog(null); location.hash = record.meta ? `/listing/${record.id}/intro` : `/record/${record.id}`
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
  // 公開：確認画面で表示した snapshot をそのまま送る。保存待ちの間に編集が入ったら、その内容は公開せず中止する。
  const publishNow = async expectedKey => {
    const record = editorRecord
    if (!record || publishLock.current) return { ok: false, message: '掲載処理中です。' }
    const shown = publicSnapshot(record), shownKey = publicationKey(shown)
    if (typeof expectedKey === 'string' && expectedKey !== shownKey) return { ok: false, message: '内容が変更されました。もう一度確認してください。' }
    publishLock.current = true
    setPublishing(true)
    try {
      if (!await flush()) throw new Error('下書きのクラウド保存が完了していません。保存状態の「再試行」を押してから、もう一度公開してください。')
      const latest = recordsRef.current.find(r => r.id === record.id)
      if (!latest || publicationKey(latest) !== shownKey) throw new Error('保存中に編集が入ったため、公開を中止しました。確認画面の内容を見直してから、もう一度「掲載する」を押してください。')
      await publishRecord(shown, session)
      const result = { ok: true, id: record.id, key: shownKey }
      setRefresh(r => r + 1); return result
    } catch (e) { const result = { ok: false, id: record.id, message: e.message }; return result } finally { publishLock.current = false; setPublishing(false) }
  }
  const stopPublication = async record => {
    if (!window.confirm('公開を停止しますか？ 共有リンクからも読めなくなります。指摘は保管されます。')) return
    try { await unpublishRecord(record.id, session.user.id); setRefresh(r => r + 1); setToast('公開を停止しました。下書きと指摘は残っています。') } catch (e) { setToast(e.message) }
  }
  const deleteRecord = async record => {
    // Re-read publication state before deleting; don't rely on a stale badge.
    try {
      if (session && record.meta) {
        const fresh = await getOwned(session.user.id)
        if (fresh.some(p => p.id === record.id && p.is_public)) throw new Error('先に公開を停止してください。')
      }
      await remove(record.id); setSelected(s => s.filter(r => r.id !== record.id)); location.hash = isRepairRecord(record) ? '/repairs' : '/mine'; setToast('記録を削除しました。')
    } catch (e) { setToast(e.message); throw e }
  }
  const restoreDevice = () => { if (window.confirm(`端末だけに保存した${deviceRecords.length}件を、このアカウントの新しい記録として取り込みますか？`)) { for (const r of deviceRecords) put({ ...fromRow(r), id: uid() }); setDeviceRecords([]); setToast('端末の記録を取り込みました。') } }
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

  const publicMode = route.view === 'discover'
  const list = publicMode ? publicState.records : records.filter(r => !isRepairRecord(r) && filterRecord(r, { query, region, filters }))
  const displayed = publicMode ? list : [...list].sort(sort === 'title' ? (a, b) => a.title.localeCompare(b.title, 'ja') : (a, b) => b.date.localeCompare(a.date))
  const selectedRecords = selected.map(r => r.publication ? r : records.find(x => x.id === r.id)).filter(Boolean)
  // スマホの公開詳細は写真を最上部に置くため、サイトロゴ行をCSSで隠す（他の画面・PC・戻る動作は変えない）。
  const headerSearch = SEARCH_ENABLED && route.view === 'discover' ? { query, onQuery: setQuery, region, onRegion: setRegion, searchRef, onSubmit: () => { const el = document.getElementById('catalog-results') || document.getElementById('content'); el?.scrollIntoView({ block: 'start', behavior: 'smooth' }); el?.focus({ preventScroll: true }) } } : null
  return <div className={`workspace${route.view === 'listing' ? ' listing-view' : ''}${route.view === 'public' ? ' public-view' : ''}${chrome.hidden ? ' chrome-hidden' : ''}`}>
    <a className="skip-link" href="#content" onClick={e => { e.preventDefault(); document.getElementById('content')?.focus() }}>本文へ移動</a>
    {route.view !== 'listing' && <SiteHeader view={navView} name={name} notify={activity.total > 0} search={headerSearch} chrome={chrome} open={searchOpen} onOpen={setSearchOpen} />}
    <main id="content" tabIndex={-1} className="main-content">
      {error && route.view !== 'listing' && (repairView ? <div className="repair-global-error" role="status"><strong>{sync.cacheFailed ? '未保存' : 'この端末に保存'}</strong><details><summary>保存状態</summary><p>{error}</p><button className="text-action" onClick={retry}>再試行</button></details></div> : <div className="workspace-error print-hidden"><ErrorNotice retry={retry}>{error}</ErrorNotice></div>)}
      {!error && needsLogin && ['mine', 'record', 'repairs', 'repair'].includes(route.view) && <div className="workspace-error print-hidden"><div className="notice" role="status"><span>記録はこの端末に保存しています。登録・ログインするとクラウドに保存し、公開や指摘ができます。</span> <button onClick={() => setDialog({ type: 'account' })}>登録・ログイン</button></div></div>}
      {route.view === 'listing' ? !ready ? <p className="loading" role="status">下書きを読み込み中…</p> : editorRecord?.meta ? <ListingFlow key={editorRecord.id} record={editorRecord} step={resolveListingStep(route.section)} onStep={step => { location.hash = `/listing/${editorRecord.id}/${step}` }} onChange={record => put(record, session?.user.id || null)} persisted={records.some(r => r.id === editorRecord.id)} session={session} flush={flush} save={{ status, error, retry, sync, session }} known={ownedReady} published={owned.some(p => p.id === editorRecord.id && p.is_public)} publication={{ ...ownPublication, retry: () => setRefresh(r => r + 1) }} publishing={publishing} onPublish={publishNow} onAccount={openAccount} /> : <Empty title="下書きが見つかりません" action={<a className="secondary" href="#/mine">自分の実践へ</a>} />
      : route.view === 'repairs' ? <RepairWorkspace records={records} ready={ready} onCreate={openRepair} sheetOpen={route.id === 'new'} initialQuery={new URLSearchParams(route.params).get('q') || ''} onSheetClose={closeRepairSheet} />
      : (route.view === 'repair' || route.view === 'record' && isRepairRecord(editorRecord)) ? !ready ? <p className="loading" role="status">修理記録を読み込み中</p> : isRepairRecord(editorRecord) ? <RepairDetail key={editorRecord.id} record={editorRecord} onSave={record => put(record, session?.user.id || null)} save={repairSave} onShare={owned.some(p => p.id === editorRecord.id && p.is_public) ? () => share(editorRecord) : undefined} management={{ known: !session || ownedReady, published: owned.some(p => p.id === editorRecord.id && p.is_public), publication: ownPublication, publishing, session, onRetry: () => setRefresh(r => r + 1), onPublish: publishNow, onUnpublish: () => stopPublication(editorRecord), onDelete: () => deleteRecord(editorRecord), onAccount: openAccount }} /> : <Empty title="修理記録が見つかりません" action={<a className="secondary" href="#/repairs">修理記録へ</a>} />
      : route.view === 'record' ? ready ? editorRecord ? <Editor key={editorRecord.id} record={editorRecord} step={STEP_KEYS.includes(route.section) ? route.section : 'basics'} onStep={step => { location.hash = step === 'review' ? `/listing/${editorRecord.id}/review` : `/record/${editorRecord.id}/${step}` }} discussion={owned.some(p => p.id === editorRecord.id) && <Discussion record={{ ...editorRecord, publication: { owner: session?.user.id, isPublic: owned.find(p => p.id === editorRecord.id)?.is_public } }} session={session} name={name} onAccount={() => setDialog({ type: 'account' })} onSeen={until => activity.markSeen(editorRecord.id, until)} />} session={session} flush={flush}
         
          save={{ status: draft && route.id === draft.id && !records.some(r => r.id === draft.id) ? '未保存の下書き · 書き始めると自動保存します' : status, error, retry, sync, session }}
          onChange={record => put(record, session?.user.id || null)} published={owned.some(p => p.id === editorRecord.id && p.is_public)} publication={{ ...ownPublication, retry: () => setRefresh(r => r + 1) }}
          onDelete={() => deleteRecord(editorRecord)} onUnpublish={() => stopPublication(editorRecord)} onShare={() => share(editorRecord)} onAccount={openAccount} /> : <Empty title="この記録は見つかりません" action={<a className="secondary" href="#/mine">自分の実践へ</a>}>保存したアカウントでログインしているか確認してください。</Empty> : <p className="loading" role="status">記録を読み込み中…</p>
      : route.view === 'public' ? recordError ? <div className="catalog"><ErrorNotice retry={() => setRefresh(r => r + 1)}>{recordError}</ErrorNotice><a href="#/discover">探すへ</a></div> : publicRecord ? route.section === 'manual' ? <ManualPage key={`${publicRecord.id}-${route.extra}`} record={publicRecord} pdf={route.extra} /> : <PublicRecord record={publicRecord} focusSection={new URLSearchParams(route.params).get('sec') || ''} onBack={backToList} selected={selected.some(r => keyOf(r) === keyOf(publicRecord))} onSelect={() => select(publicRecord)} saved={bookmarks.ids.includes(publicRecord.id)} onSave={() => heart(publicRecord)} onShare={() => share(publicRecord)} ready={ready}
          session={session} onAccount={openAccount} notify={setToast} editHref={session?.user.id && session.user.id === publicRecord.publication.owner ? `#/record/${publicRecord.id}/content` : null}
          canFollow={!!publicRecord.publication.owner && session?.user.id !== publicRecord.publication.owner} following={follows.ids.includes(publicRecord.publication.owner)} onFollow={() => follows.toggle(publicRecord.publication.owner, publicRecord.meta?.author || '発表者')} discussion={<Discussion key={publicRecord.id} record={publicRecord} session={session} name={name} onAccount={() => setDialog({ type: 'account' })} onSeen={until => activity.markSeen(publicRecord.id, until)} />} /> : <p className="loading" role="status">記録を読み込み中…</p>
      : route.view === 'talks' ? <Talks session={session} bookmarks={bookmarks} onAccount={() => setDialog({ type: 'account' })} />
      : route.view === 'compare' ? <Compare records={selectedRecords} onRemove={select} onBack={backFromCompare} />
      : route.view === 'list' ? <SharedList key={route.id} token={route.id} savedIds={bookmarks.ids} onSave={heart} keyOf={keyOf} selectedKeys={selected.map(keyOf)} onSelect={select} />
      : route.view === 'account' ? <AccountPage section={route.id} session={session} name={name} onName={rename} flush={flush} owned={owned} selectedCount={selected.length} notify={setToast}
          activitySaved={bookmarks.rows.reduce((n, b) => n + (activity.counts[b.id] || 0), 0)} activityMine={owned.reduce((n, p) => n + (activity.counts[p.id] || 0), 0)}
          data={{ ready, exportAll, importBackup, deviceRecords, restoreDevice }} />
      : route.view === 'user' ? <User key={route.id} id={route.id} savedIds={bookmarks.ids} onSave={heart} selectedKeys={selected.map(keyOf)} keyOf={keyOf} onSelect={select} />
      : route.view === 'saved' ? <SavedList session={session} view={route.id} list={lists.lists.find(l => l.id === route.id)} lists={lists} picking={picking} onPicking={setPicking} notify={setToast} records={publicState.records} count={publicState.count} loading={publicState.loading || !bookmarks.ready}
          error={bookmarks.error ? <ErrorNotice retry={bookmarks.retry}>{bookmarks.error}</ErrorNotice> : publicState.error ? <ErrorNotice retry={() => setRefresh(r => r + 1)}>{publicState.error}</ErrorNotice> : null}
          page={publicPage} onPage={setPublicPage} savedIds={bookmarks.ids} onSave={heart} activityCounts={activity.counts} keyOf={keyOf} selectedKeys={selected.map(keyOf)} onSelect={select} onAccount={() => setDialog({ type: 'account' })} />
      : <Catalog view={route.view} page={publicPage} records={displayed} total={publicMode ? publicState.count : displayed.length} loading={publicMode ? publicState.loading : !ready}
          error={publicMode && publicState.error ? <ErrorNotice retry={() => setRefresh(r => r + 1)}>{publicState.error}</ErrorNotice> : null}
          query={query} onQuery={setQuery} region={region} onRegion={setRegion}
          filters={filters} onFilters={setFilters} sort={sort} onSort={setSort} onReset={resetSearch} onRepair={startRepair} savedIds={bookmarks.ids} onSave={heart} activityCounts={activity.counts} searchRef={searchRef} keyOf={keyOf} selectedKeys={selected.map(keyOf)} onSelect={select}
          owned={owned} ownedReady={ownedReady} ready={ready} onCreate={() => create('presentation')}
          blankCount={publicMode ? 0 : records.filter(r => isBlankRecord(r) && !owned.some(p => p.id === r.id && p.is_public)).length} onCleanup={cleanupBlankRecords}>
        {publicMode && publicState.count > PAGE_SIZE && <div className="pagination"><button className="secondary" disabled={publicPage === 0 || publicState.loading} onClick={() => setPublicPage(p => p - 1)}>前へ</button><span>{publicPage + 1} / {Math.ceil(publicState.count / PAGE_SIZE)}</span><button className="secondary" disabled={(publicPage + 1) * PAGE_SIZE >= publicState.count || publicState.loading} onClick={() => setPublicPage(p => p + 1)}>次へ</button></div>}
      </Catalog>}
    </main>
    {!!selected.length && !['compare', 'listing'].includes(route.view) && <div className="compare-tray print-hidden"><span>{selected.length}件を選択中</span>{selected.length >= 2 ? <a href="#/compare">並べて比較する</a> : <em className="tray-hint">あと1件選ぶと比較できます</em>}<button onClick={() => setSelected([])}>解除</button></div>}
    {route.view !== 'listing' && <nav className={`mobile-nav print-hidden${chrome.hidden ? ' is-hidden' : ''}`} aria-label="モバイルナビゲーション">{NAV.map(([id, label, icon]) => <a key={id} href={`#/${id}`} aria-current={currentTab(id, navView) ? 'page' : undefined} aria-label={id === 'talks' && activity.total > 0 ? '対話（新着の指摘あり）' : undefined}><span className="nav-icon">{id === 'talks' && activity.total > 0 && <i className="notify-dot" aria-hidden="true" />}<Icon name={icon} size={23} /></span><span>{label}</span></a>)}</nav>}
    {toast && <div className="toast print-hidden" role="status">{typeof toast === 'string' ? toast : <>{toast.text}<button className="toast-action" onClick={() => { const run = toast.action.run; setToast(''); run() }}>{toast.action.label}</button></>}</div>}
    {sheetRecord && session && <SaveSheet key={sheetRecord.id} record={sheetRecord} lists={lists} onClose={() => setSheetRecord(null)} onUnsave={async () => { await bookmarks.toggle(sheetRecord); setSheetRecord(null) }} />}
    {dialog?.type === 'account' && <Account session={session} flush={flush} onClose={() => setDialog(null)} />}
    {dialog?.type === 'share' && <Dialog title="公開リンク" onClose={() => setDialog(null)}><p>{actionError}</p><input aria-label="公開リンク" readOnly value={`${location.origin}${location.pathname}#/public/${dialog.record.id}`} onFocus={e => e.target.select()} /></Dialog>}
  </div>
}
function snapshotWithPublication(record) { return { ...snapshot(record), ...(record.publication ? { publication: record.publication } : {}) } }
class ErrorBoundary extends React.Component {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() { return this.state.error ? <div className="empty"><h1>画面を表示できませんでした</h1><p>保存済みの記録は削除していません。</p><button className="primary" onClick={() => location.reload()}>再読み込み</button></div> : this.props.children }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><PrivateAccess>{session => <Suspense fallback={<p className="loading" role="status">画面を準備しています…</p>}><App key={session.user.id} verifiedSession={session} /></Suspense>}</PrivateAccess></ErrorBoundary>)
