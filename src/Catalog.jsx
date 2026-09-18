import React, { useEffect, useRef, useState } from 'react'
import Cover from './Cover.jsx'
import Icon from './Icon.jsx'
import FilterDialog from './FilterDialog.jsx'
import { KINDS, PHASES, number, formatNumber } from './domain.js'
import { imageAttachments } from './attachment-domain.js'
import { resolveMachineTarget, MACHINE_SUBJECT } from './machine-domain.js'
import MachineCardMedia from './MachineCardMedia.jsx'
import { repairHeadline, repairMachineLabel } from './repair-entry.mjs'
import { searchRepairMachines } from './repair-workspace.mjs'
import { countFilters, EMPTY_FILTERS, CHIPS, activeChip, discoverHref } from './search.js'
import { SEARCH_ENABLED } from './flags.js'
import { isCatalogRecord, parseCatalogTitle } from './catalog-domain.js'
import { Empty, ErrorNotice } from './ui.jsx'
import { listPublic } from './community.js'
import { isDiscoveryHome } from './discovery-domain.js'
// 分類チップ列（Airbnb のカテゴリ行）。押すと URL 駆動で #/discover へ遷移し、検索語・地域・記録日・数字条件は引き継ぐ。
// 選択中をもう一度押すと解除。右端の「絞り込み」はチップ由来の kind／crop を件数に数えない。
export function CategoryChips({ query, region, filters, onFilter }) {
  const current = activeChip(filters)
  const go = (kind, crop) => { location.hash = discoverHref({ query, region, filters: { ...filters, kind, crop, stage: 'all' }, page: 0 }) }
  const active = countFilters({ ...filters, ...(current ? { kind: 'all', crop: '' } : {}) })
  // 絞り込みボタンは横スクロールする列の外に置く（列の中に sticky で置くと、スマホでチップがボタンの右側を通り過ぎて見えた）。
  return <div className="category-bar">
    <div className="category-chips" role="group" aria-label="分類で絞り込む">
      <button aria-pressed={!current && filters.kind === 'all' && !filters.crop} onClick={() => go('all', '')}>すべて</button>
      {CHIPS.map(([label, f]) => { const pressed = current?.[0] === label; return <button key={label} aria-pressed={pressed} onClick={() => pressed ? go('all', '') : go(f.kind, f.crop)}>{label}</button> })}
    </div>
    <button className="filter-button" onClick={onFilter}><Icon name="filter" size={18} /><span>絞り込み{active ? ` · ${active}` : ''}</span></button>
  </div>
}
// 公開カードの操作は「本体で詳細を開く」「ハートで保存」だけに絞る。比較・質問・メモ・フォローは発表詳細の入口へ移した。
// 自分の実践のカードは、公開ラベルと比較ボタンをそのまま残す。
export function RecordCard({ record: r, href, selected, onSelect, publicMode, publicationLabel, saved, onSave, picking = false, newCount = 0 }) {
  const evidence = r.meta?.observations?.filter(o => o.fact.trim()).length || 0
  const metric = [['hours', '作業時間', '時間'], ['yieldKg', '収穫量', 'kg'], ['revenue', '売上', '円']].find(([key]) => number(r.meta?.[key]) !== null)
  // 機械修理の記録は、3D登録機なら写真の代わりに機械全体の静止画像と対象名を上部に出す（写真データ自体は残る）。
  // 3Dのない修理記録（machineRef なし）は写真か文字カバーで、機械名は本人の入力（メーカー 型式）から出す。
  const repair = r.meta?.subject === MACHINE_SUBJECT
  const machine = resolveMachineTarget(r.meta)
  const machineMode = repair && !!r.meta.machineRef
  // カタログ解説はメーカー・型式・製品名で見分ける（題名の【カタログ解説】と分類の繰り返しでは並べたときに区別がつかない）。
  const catalog = isCatalogRecord(r) ? parseCatalogTitle(r.title) : null
  return <article className="record-card"><div className="card-visual">{machineMode
    ? <MachineCardMedia target={machine} machineRef={r.meta.machineRef} href={href} />
    : <CardPhotos record={r} href={href} label={repair ? repairMachineLabel(r.meta.repair) : catalog ? `${catalog.maker} ${catalog.model}` : ''} sub={catalog ? catalog.name || catalog.category : ''} />}
    <span className="card-badge">{repair ? '修理' : r.meta?.kind === 'challenge' ? r.meta.stage : KINDS[r.meta?.kind || 'memo']}</span>
    {newCount > 0 && <span className="card-badge activity">新着の指摘 {newCount}件</span>}
    {publicMode && onSave && <button className="save-heart" aria-pressed={saved} aria-label={`${r.title || '無題'}${saved ? 'の保存先を選ぶ' : 'を保存する'}`} onClick={() => onSave(r)}><Icon name="heart" size={25} fill={saved ? '#ff385c' : '#0006'} /></button>}
    {picking && <button className="pick-box" aria-pressed={selected} aria-label={`${r.title || '無題'}を${selected ? '比較から外す' : '比較に選ぶ'}`} onClick={() => onSelect(r)}><Icon name="check" size={16} /></button>}
  </div><a href={href} className={`card-copy${catalog ? ' catalog-copy' : ''}`}>
    {catalog ? <><h2>{catalog.maker} {catalog.model}</h2><p className="card-description">{[catalog.name, catalog.category].filter(Boolean).join(' · ')}</p></> : <>
      <div className="card-location"><strong>{repair ? (machineMode ? machine.label : repairMachineLabel(r.meta.repair) || '機械未確認') : [r.meta?.region, r.meta?.crop].filter(Boolean).join(' · ') || '自分の記録'}</strong>{evidence > 0 && <span>観測 {evidence}</span>}</div>
      <h2>{repair && !machineMode && r.title === repairMachineLabel(r.meta.repair) ? repairHeadline(r.meta.repair) || r.meta.issue || r.title : r.title || '無題の記録'}</h2>
      {!repair && <div className="card-author">{r.meta?.author || '名前未登録'}{r.meta?.club && ` · ${r.meta.club}`}</div>}
      <div className="card-bottom">{metric && !repair ? <span><strong>{formatNumber(number(r.meta[metric[0]]))}</strong> {metric[2]}<span className="metric-caption"> / {metric[1]}</span></span> : <time dateTime={r.date}>{r.date.replaceAll('-', '.')}</time>}</div>
    </>}
  </a>
  {!publicMode && r.meta?.kind === 'challenge' && (r.meta.deadline || r.meta.origin) && <div className="card-meta-line">{r.meta.deadline && <span>振り返る日 {r.meta.deadline.replaceAll('-', '.')}</span>}{r.meta.origin && <span>参考：{r.meta.origin.title || '記録'}</span>}</div>}
  {!publicMode && <div className="card-utility">{publicationLabel === '公開中' ? <a className="published-link" href={`#/listing/${r.id}/review`}>公開中</a> : <span>{publicationLabel}</span>}<button className="text-action" aria-pressed={selected} onClick={() => onSelect(r)}><Icon name={selected ? 'check' : 'plus'} size={15} />{selected ? '比較に選択済み' : '比較する'}</button></div>}</article>
}
function CardPhotos({ record, href, label, sub }) {
  const track = useRef(null)
  const count = Math.max(1, imageAttachments(record).length)
  const [index, setIndex] = useState(0)
  const move = next => {
    const el = track.current
    el?.scrollTo({ left: Math.max(0, Math.min(count - 1, next)) * el.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return <>
    <div className="card-photo-track" ref={track} onScroll={e => { const el = e.currentTarget; if (el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth)) }}>
      {Array.from({ length: count }, (_, i) => <a key={i} href={href} className="cover-link" tabIndex={-1} aria-hidden="true"><Cover record={record} label={label} sub={sub} index={i} /></a>)}
    </div>
    {count > 1 && <><button className="photo-arrow prev" disabled={index === 0} aria-label="前の写真" onClick={() => move(index - 1)}><Icon name="left" size={16} /></button><button className="photo-arrow next" disabled={index >= count - 1} aria-label="次の写真" onClick={() => move(index + 1)}><Icon name="right" size={16} /></button><div className="photo-dots" aria-hidden="true">{Array.from({ length: Math.min(count, 5) }, (_, i) => <i key={i} className={i === Math.min(index, 4) ? 'active' : ''} />)}</div><span className="sr-only" aria-live="polite">写真 {index + 1} / {count}</span></>}
  </>
}

const discoveryPositions = new Map()
function DiscoveryRow({ label, filter, immediate, renderCard }) {
  const section = useRef(null), rail = useRef(null)
  const [visible, setVisible] = useState(immediate), [retry, setRetry] = useState(0)
  const [state, setState] = useState({ loading: true, records: [], error: '' })
  const [edges, setEdges] = useState({ start: true, end: false })
  const href = discoverHref({ filters: { ...EMPTY_FILTERS, ...filter } })
  useEffect(() => {
    if (visible) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect() } }, { rootMargin: '240px' })
    if (section.current) observer.observe(section.current)
    return () => observer.disconnect()
  }, [visible])
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: '' }))
    listPublic({ filters: { ...EMPTY_FILTERS, ...filter }, limit: 12 }).then(data => { if (!cancelled) setState({ ...data, loading: false, error: '' }) }).catch(error => { if (!cancelled) setState({ records: [], loading: false, error: error.message }) })
    return () => { cancelled = true }
  }, [visible, filter, retry])
  const measure = () => { const el = rail.current; if (el) setEdges({ start: el.scrollLeft < 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 }) }
  useEffect(() => {
    if (!state.loading && rail.current) rail.current.scrollLeft = discoveryPositions.get(label) || 0
    measure()
    const el = rail.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure); observer.observe(el)
    return () => observer.disconnect()
  }, [state.loading, state.records.length])
  const move = direction => {
    const el = rail.current
    if (!el) return
    const card = el.firstElementChild, step = (card?.getBoundingClientRect().width || el.clientWidth) + (parseFloat(getComputedStyle(el).columnGap) || 0)
    el.scrollBy({ left: direction * step * Math.max(1, Math.floor(el.clientWidth / step)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  if (!state.loading && !state.error && !state.records.length) return null
  return <section className="discovery-row" ref={section} aria-label={label}>
    <div className="discovery-row-head"><h2><a href={href}>{label}<Icon name="right" size={18} /></a></h2><div className="discovery-row-actions"><a href={href}>すべて表示</a><button disabled={state.loading || edges.start} aria-label={`${label}：前へ`} onClick={() => move(-1)}><Icon name="left" size={16} /></button><button disabled={state.loading || edges.end} aria-label={`${label}：次へ`} onClick={() => move(1)}><Icon name="right" size={16} /></button></div></div>
    {state.error ? <ErrorNotice retry={() => setRetry(n => n + 1)}>{state.error}</ErrorNotice> : <div className="discovery-rail" ref={rail} onScroll={e => { if (!state.loading) discoveryPositions.set(label, e.currentTarget.scrollLeft); measure() }} aria-label={`${label}の一覧`} tabIndex={0} onKeyDown={e => { if (e.target !== e.currentTarget || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1) }}>
      {state.loading ? Array.from({ length: 6 }, (_, i) => <div key={i} className="card-skeleton" aria-hidden="true"><div /><span /><span /></div>) : state.records.map(renderCard)}
      {state.loading && <span className="sr-only" role="status">{label}を読み込み中</span>}
    </div>}
  </section>
}
// 探す（#/discover）は URL 駆動の1つの格子：チップ列（＋絞り込み）→ 条件ありなら件数行 → 格子 → ページ送り。検索ピルは上部ヘッダー（SiteHeader）に固定。
// 自分の実践（#/mine）は h1・件数・並び順・作成ボタン・分類チップ・進捗チップ・格子だけ（ピル・絞り込みは置かない）。
export default function Catalog({ view, page = 0, records, total, loading, error, query, onQuery, sort, onSort, region, onRegion, filters = EMPTY_FILTERS, onFilters, onReset, onRepair, searchRef, selectedKeys, keyOf, onSelect, savedIds = [], onSave, activityCounts = {}, owned = [], ownedReady, ready, onCreate, blankCount = 0, onCleanup, children }) {
  const [filterOpen, setFilterOpen] = useState(false)
  const publicMode = view === 'discover', active = countFilters(filters)
  const searching = query.trim() || region.trim() || active
  const home = publicMode && isDiscoveryHome({ query, region, filters, sort, page })
  const card = r => <RecordCard key={r.id} record={r} href={`#/${publicMode ? 'public' : r.meta && !owned.some(p => p.id === r.id && p.is_public) ? 'listing' : 'record'}/${r.id}`} selected={selectedKeys.includes(keyOf(r))} onSelect={onSelect} publicMode={publicMode} saved={savedIds.includes(r.id)} onSave={onSave} newCount={publicMode ? 0 : activityCounts[r.id] || 0} publicationLabel={owned.some(p => p.id === r.id && p.is_public) ? '公開中' : ownedReady ? '自分だけ' : '公開状態未確認'} />
  const q = query.trim()
  // 0件からの修理導線：登録機に一致しない型式は1タップで3Dなしの記録を始め、一致するときは本人が3Dあり／なしを選ぶ（型式から登録機種を推測しない）。
  const repairAction = q ? searchRepairMachines(q).length ? <a className="primary" href={`#/repairs/new?q=${encodeURIComponent(q)}`}>「{q}」の修理を記録する</a> : <button className="primary" disabled={!ready} onClick={() => onRepair(q)}>「{q}」の修理を記録する</button> : <a className="primary" href="#/repairs/new">修理を記録する</a>
  return <section className={`catalog${home ? ' discovery-home' : ''}`}>
    {SEARCH_ENABLED && publicMode && <CategoryChips query={query} region={region} filters={filters} onFilter={() => setFilterOpen(true)} />}
    {publicMode ? <><h1 className="sr-only">記録を探す</h1>{!home && <div className="discover-count" id="catalog-results" tabIndex={-1}><span>{loading ? '読み込み中' : `${total ?? 0}件`}</span><button className="text-action" onClick={onReset}>条件をクリア</button></div>}</>
      : <div className="page-heading" id="catalog-results" tabIndex={-1}><div><h1>{searching ? '自分の実践の検索結果' : '自分の実践'}</h1></div><div className="result-tools"><span>{loading ? '読み込み中' : `${total}件`}</span><select aria-label="並び順" value={sort} onChange={e => onSort(e.target.value)}><option value="recent">新しい順</option><option value="title">タイトル順</option></select></div></div>}
    {view === 'mine' && <div className="workspace-links"><button className="text-action" disabled={!ready} onClick={onCreate}>新しく掲載する</button>{blankCount > 0 && <button className="text-action" disabled={!ready} onClick={onCleanup}>空の記録を整理（{blankCount}件）</button>}</div>}
    {view === 'mine' && <div className="kind-chips" role="group" aria-label="分類で絞り込む">{[['all', 'すべて'], ['presentation', '発表'], ['challenge', '挑戦'], ['learning', '学習ノート'], ['trouble', 'カタログ']].map(([key, label]) => <button key={key} aria-pressed={filters.kind === key} onClick={() => onFilters({ ...filters, kind: key, stage: key === 'challenge' ? filters.stage : 'all' })}>{label}</button>)}</div>}
    {view === 'mine' && filters.kind === 'challenge' && <div className="kind-chips stage-chips" role="group" aria-label="進捗で絞り込む">{[['all', 'すべての進捗'], ...PHASES.map(p => [p, p])].map(([key, label]) => <button key={key} aria-pressed={filters.stage === key} onClick={() => onFilters({ ...filters, stage: key })}>{label}</button>)}</div>}
    {!home && error}
    {home ? <div className="discovery-rows">{CHIPS.map(([label, filter], i) => <DiscoveryRow key={label} label={label} filter={filter} immediate={i < 2} renderCard={card} />)}</div> : loading ? <div className="loading-grid" role="status" aria-label="記録を読み込み中">{[0, 1, 2, 3, 4, 5].map(i => <div className="card-skeleton" key={i}><div /><span /><span /></div>)}</div> : records.length ? <div className="record-grid">{records.map(card)}</div>
      : !error && (publicMode
        ? <Empty title={searching ? '該当する記録はありません' : '最初の記録を掲載しよう'} action={searching ? <div className="actions">{repairAction}<button className="text-action" onClick={onReset}>条件をクリア</button></div> : <a className="primary" href="#/repairs/new">修理を記録する</a>}>{searching ? '短い単語や、別の条件で探してみてください。' : '公開された記録がここに並びます。'}</Empty>
        : <Empty title={searching ? '一致する記録がありません' : 'ひとつ目の記録をつくろう'} action={searching ? <button className="secondary" onClick={onReset}>条件をクリア</button> : <button className="primary" disabled={!ready} onClick={onCreate}>記録を書き始める</button>}>{searching ? '短い単語や、別の条件で探してみてください。' : '写真や数字、気づいたことから残せます。'}</Empty>)}
    {!home && children}
    {filterOpen && <FilterDialog filters={filters} onApply={onFilters} onClose={() => setFilterOpen(false)} />}
  </section>
}
