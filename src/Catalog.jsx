import React, { useState } from 'react'
import Cover from './Cover.jsx'
import Icon from './Icon.jsx'
import FilterDialog from './FilterDialog.jsx'
import { KINDS, number, formatNumber } from './domain.js'
import { imageAttachments } from './attachment-domain.js'
import { countFilters, EMPTY_FILTERS } from './search.js'
import { SEARCH_ENABLED } from './flags.js'
import { Empty } from './ui.jsx'
const topics = ['すべて', 'ブロッコリー', 'トマト', '水稲', '育苗', '土づくり', '省力化']
export function RecordCard({ record: r, href, selected, onSelect, publicMode, publicationLabel, saved, onSave, newCount = 0 }) {
  const [index, setIndex] = useState(0)
  const photos = imageAttachments(r), evidence = r.meta?.observations?.filter(o => o.fact.trim()).length || 0
  const metric = [['hours', '作業時間', '時間'], ['yieldKg', '収穫量', 'kg'], ['revenue', '売上', '円']].find(([key]) => number(r.meta?.[key]) !== null)
  return <article className="record-card"><div className="card-visual"><a href={href} className="cover-link" tabIndex={-1} aria-hidden="true"><Cover record={r} index={Math.min(index, Math.max(0, photos.length - 1))} /></a>
    <span className="card-badge">{r.meta?.kind === 'challenge' ? r.meta.stage : KINDS[r.meta?.kind || 'memo']}</span>
    {newCount > 0 && <span className="card-badge activity">新着の指摘 {newCount}件</span>}
    {publicMode && onSave && <button className="save-heart" aria-pressed={saved} aria-label={`${r.title || '無題'}を${saved ? '保存リストから外す' : '保存リストに追加'}`} onClick={() => onSave(r)}><Icon name="heart" size={25} fill={saved ? '#ff385c' : '#0006'} /></button>}
    {photos.length > 1 && <><button className="photo-arrow prev" aria-label="前の写真" onClick={() => setIndex((index + photos.length - 1) % photos.length)}><Icon name="left" size={14} /></button><button className="photo-arrow next" aria-label="次の写真" onClick={() => setIndex((index + 1) % photos.length)}><Icon name="right" size={14} /></button><div className="photo-dots" aria-hidden="true">{photos.slice(0, 5).map((p, i) => <i key={p.path} className={i === Math.min(index, 4) ? 'active' : ''} />)}</div></>}
  </div><a href={href} className="card-copy"><div className="card-location"><strong>{[r.meta?.region, r.meta?.crop].filter(Boolean).join(' · ') || '自分の記録'}</strong>{evidence > 0 && <span>観測 {evidence}</span>}</div><h2>{r.title || '無題の記録'}</h2><div className="card-author">{r.meta?.author || '名前未登録'}{r.meta?.club && ` · ${r.meta.club}`}</div><div className="card-bottom">{metric ? <span><strong>{formatNumber(number(r.meta[metric[0]]))}</strong> {metric[2]}<span className="metric-caption"> / {metric[1]}</span></span> : <time dateTime={r.date}>{r.date.replaceAll('-', '.')}</time>}</div></a>
  <div className="card-utility">{!publicMode && <span>{publicationLabel}</span>}<button className="text-action" aria-pressed={selected} onClick={() => onSelect(r)}><Icon name={selected ? 'check' : 'plus'} size={15} />{selected ? '比較に選択済み' : '比較する'}</button></div></article>
}
export default function Catalog({ view, records, total, loading, error, query, onQuery, sort, onSort, region, onRegion, filters = EMPTY_FILTERS, onFilters, searchRef, selectedKeys, keyOf, onSelect, savedIds = [], onSave, activityCounts = {}, owned = [], ownedReady, ready, onCreate, children }) {
  const [filterOpen, setFilterOpen] = useState(false)
  const publicMode = view === 'discover', active = countFilters(filters)
  const title = view === 'discover' ? 'みんなの経営発表' : view === 'challenges' ? '自分の挑戦' : view === 'learning' ? '学習ノート' : '自分の記録'
  const searching = query.trim() || region.trim() || active
  return <section className="catalog">
    {SEARCH_ENABLED && <><div className="search-area"><form className="search-pill" role="search" aria-label="記録を検索" onSubmit={e => { e.preventDefault(); document.getElementById('catalog-results')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); document.getElementById('catalog-results')?.focus({ preventScroll: true }) }}>
      <label className="search-part"><span>キーワード</span><input ref={searchRef} type="search" maxLength={160} value={query} onChange={e => onQuery(e.target.value)} placeholder="作物や課題から探す" /></label>
      <label className="region-part"><span>地域</span><input type="search" maxLength={80} value={region} onChange={e => onRegion(e.target.value)} placeholder="すべての地域" /></label>
      <button type="button" className="search-filter-part" onClick={() => setFilterOpen(true)}><span>条件</span><strong>{active ? `${active}つの条件` : '条件を追加'}</strong></button><button className="search-submit" aria-label="検索する"><Icon name="search" size={21} /></button>
    </form></div>
    <div className="browse-controls"><div className="topic-tabs" aria-label="テーマで探す">{topics.map(topic => <button key={topic} aria-pressed={topic === 'すべて' ? !query : query === topic} onClick={() => onQuery(topic === 'すべて' ? '' : topic)}>{topic}</button>)}</div><button className="filter-button" onClick={() => setFilterOpen(true)}><Icon name="filter" size={18} /><span>絞り込み{active ? ` · ${active}` : ''}</span></button></div></>}
    <div className="page-heading" id="catalog-results" tabIndex={-1}><div><h1>{searching ? `${title}の検索結果` : title}</h1></div><div className="result-tools"><span>{loading ? '読み込み中' : `${total}件`}</span><select aria-label="並び順" value={sort} onChange={e => onSort(e.target.value)}><option value="recent">新しい順</option><option value="title">タイトル順</option></select></div></div>
    {view === 'mine' && <div className="workspace-links"><button className="text-action" disabled={!ready} onClick={onCreate}>新しい発表をつくる</button></div>}
    {error}
    {loading ? <div className="loading-grid" role="status" aria-label="記録を読み込み中">{[0, 1, 2, 3, 4, 5].map(i => <div className="card-skeleton" key={i}><div /><span /><span /></div>)}</div> : records.length ? <div className="record-grid">{records.map(r => <RecordCard key={r.id} record={r} href={`#/${publicMode ? 'public' : 'record'}/${r.id}`} selected={selectedKeys.includes(keyOf(r))} onSelect={onSelect} publicMode={publicMode} saved={savedIds.includes(r.id)} onSave={onSave} newCount={publicMode ? 0 : activityCounts[r.id] || 0} publicationLabel={owned.some(p => p.id === r.id && p.is_public) ? '公開中' : ownedReady ? '自分だけ' : '公開状態未確認'} />)}</div>
      : !error && <Empty title={searching ? '一致する記録がありません' : publicMode ? '最初の経営発表を掲載しよう' : 'ひとつ目の記録をつくろう'} action={searching ? <button className="secondary" onClick={() => { onQuery(''); onRegion(''); onFilters({ ...EMPTY_FILTERS }) }}>条件をクリア</button> : <button className="primary" disabled={!ready} onClick={onCreate}>記録を書き始める</button>}>{searching ? '短い単語や、別の条件で探してみてください。' : '写真や数字、気づいたことから残せます。'}</Empty>}
    {children}
    {filterOpen && <FilterDialog filters={filters} onApply={onFilters} onClose={() => setFilterOpen(false)} />}
  </section>
}
