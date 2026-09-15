import React, { useEffect, useId, useState } from 'react'
import Cover from './Cover.jsx'
import Icon from './Icon.jsx'
import FilterDialog from './FilterDialog.jsx'
import { KINDS, PHASES, number, formatNumber } from './domain.js'
import { imageAttachments } from './attachment-domain.js'
import { countFilters, EMPTY_FILTERS, SORTS, snippet, relaxations } from './search.js'
import { expandQuery } from './synonyms.js'
import { readRecent, rememberSearch, clearRecent, suggestKeywords, suggestRegions, SUGGEST_LABELS } from './suggest.js'
import { SEARCH_ENABLED } from './flags.js'
import { Empty } from './ui.jsx'
// 候補の一覧（キーワード・地域で共用）。マウス操作は onMouseDown で入力のフォーカスを保つ。
function SuggestList({ id, items, cursor, onPick, onClear, emptyText }) {
  if (!items.length && !emptyText) return null
  let lastKind = null
  return <ul className="suggest-list" role="listbox" id={id}>
    {!items.length && <li className="suggest-empty">{emptyText}</li>}
    {items.map((item, i) => {
      const head = item.kind !== lastKind ? item.kind : null; lastKind = item.kind
      return <React.Fragment key={`${item.kind}:${item.value}`}>
        {head && <li className="suggest-head" role="presentation">{SUGGEST_LABELS[head]}{head === 'recent' && onClear && <button type="button" className="text-action" onMouseDown={e => e.preventDefault()} onClick={onClear}>履歴を消す</button>}</li>}
        <li role="option" id={`${id}-${i}`} aria-selected={cursor === i}><button type="button" tabIndex={-1} onMouseDown={e => e.preventDefault()} onClick={() => onPick(item)}><Icon name={item.kind === 'recent' ? 'clock' : 'search'} size={15} />{item.value}</button></li>
      </React.Fragment>
    })}
  </ul>
}
// 検索ピルはホームと検索結果ページで共用する。入力は呼び出し側の状態（URL由来か画面内）に従う。
// 候補（最近の検索・作物・課題・関連する語・都道府県）は入力中に表示し、選ぶと確定する。
export function SearchPill({ query, onQuery, region, onRegion, active = 0, onFilter, onSubmit, searchRef, crops = [], regions = [] }) {
  const listId = useId()
  const [focus, setFocus] = useState(null), [cursor, setCursor] = useState(-1), [recent, setRecent] = useState(readRecent)
  const items = focus === 'query' ? suggestKeywords(query, { recent, crops }) : focus === 'region' ? suggestRegions(region, { regions }) : []
  const submit = (patch = {}) => { const q = patch.query ?? query; if (q.trim()) setRecent(rememberSearch(q)); setFocus(null); setCursor(-1); onSubmit(patch) }
  const pick = item => { if (focus === 'region') { onRegion(item.value); setFocus(null); setCursor(-1) } else { onQuery(item.value); submit({ query: item.value }) } }
  const keys = e => {
    if (!items.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => (c + 1) % items.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => (c - 1 + items.length) % items.length) }
    else if (e.key === 'Enter' && cursor >= 0) { e.preventDefault(); pick(items[cursor]) }
    else if (e.key === 'Escape') { setFocus(null); setCursor(-1) }
  }
  const open = part => { setFocus(part); setCursor(-1) }
  const active_ = focus && cursor >= 0 ? `${listId}-${cursor}` : undefined
  return <form className="search-pill" role="search" aria-label="発表を検索" onSubmit={e => { e.preventDefault(); submit() }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setFocus(null); setCursor(-1) } }}>
    <label className="search-part"><span>キーワード</span><input ref={searchRef} type="search" maxLength={160} value={query} autoComplete="off" role="combobox" aria-expanded={focus === 'query' && items.length > 0} aria-controls={listId} aria-activedescendant={focus === 'query' ? active_ : undefined} aria-autocomplete="list"
      onChange={e => { onQuery(e.target.value); setCursor(-1) }} onFocus={() => open('query')} onKeyDown={keys} placeholder="作物や課題から探す" />
      {focus === 'query' && <SuggestList id={listId} items={items} cursor={cursor} onPick={pick} onClear={() => setRecent(clearRecent())} />}</label>
    <label className="region-part"><span>地域</span><input type="search" maxLength={80} value={region} autoComplete="off" role="combobox" aria-expanded={focus === 'region' && items.length > 0} aria-controls={listId} aria-activedescendant={focus === 'region' ? active_ : undefined} aria-autocomplete="list"
      onChange={e => { onRegion(e.target.value); setCursor(-1) }} onFocus={() => open('region')} onKeyDown={keys} placeholder="すべての地域" />
      {focus === 'region' && <SuggestList id={listId} items={items} cursor={cursor} onPick={pick} />}</label>
    <button type="button" className="search-filter-part" onClick={onFilter}><span>条件</span><strong>{active ? `${active}つの条件` : '条件を追加'}</strong></button>
    <button className="search-submit" aria-label="検索する"><Icon name="search" size={21} /></button>
  </form>
}
// 一致箇所の抜粋（検索結果のカードだけ）。
function Snippet({ record, highlight }) {
  const s = highlight ? snippet(record, highlight.query, highlight.exact) : null
  return s ? <p className="card-snippet">{s.before}<mark>{s.match}</mark>{s.after}</p> : null
}
// 0件のとき、条件を1つ外した場合の件数を数えて提案する（件数が0の提案は出さない）。
function Relaxations({ state, countFor, onRelax }) {
  const [items, setItems] = useState(null)
  const candidates = relaxations(state)
  const key = candidates.map(c => c.key).join('|') + JSON.stringify(state)
  useEffect(() => {
    let cancelled = false
    setItems(null)
    if (!candidates.length || !countFor) return
    Promise.all(candidates.slice(0, 6).map(c => countFor({ ...state, ...c.patch }).then(n => ({ ...c, count: n })).catch(() => null)))
      .then(list => { if (!cancelled) setItems(list.filter(x => x && x.count > 0)) })
    return () => { cancelled = true }
  }, [key])
  if (!items?.length) return null
  return <div className="relax-list" role="group" aria-label="条件を1つ外す"><span>条件を1つ外すと見つかります</span>{items.map(c => <button key={c.key} className="secondary" onClick={() => onRelax(c.patch)}>{c.label}<b>{c.count}件</b></button>)}</div>
}
// 公開カードの操作は「本体で詳細を開く」「ハートで保存」だけに絞る。比較・質問・メモ・フォローは発表詳細の入口へ移した。
// 自分の実践のカードは、公開ラベルと比較ボタンをそのまま残す。
export function RecordCard({ record: r, href, selected, onSelect, publicMode, publicationLabel, saved, onSave, picking = false, newCount = 0, highlight = null }) {
  const [index, setIndex] = useState(0)
  const photos = imageAttachments(r), evidence = r.meta?.observations?.filter(o => o.fact.trim()).length || 0
  const metric = [['hours', '作業時間', '時間'], ['yieldKg', '収穫量', 'kg'], ['revenue', '売上', '円']].find(([key]) => number(r.meta?.[key]) !== null)
  return <article className="record-card"><div className="card-visual"><a href={href} className="cover-link" tabIndex={-1} aria-hidden="true"><Cover record={r} index={Math.min(index, Math.max(0, photos.length - 1))} /></a>
    <span className="card-badge">{r.meta?.kind === 'challenge' ? r.meta.stage : KINDS[r.meta?.kind || 'memo']}</span>
    {newCount > 0 && <span className="card-badge activity">新着の指摘 {newCount}件</span>}
    {publicMode && onSave && <button className="save-heart" aria-pressed={saved} aria-label={`${r.title || '無題'}${saved ? 'の保存先を選ぶ' : 'を保存する'}`} onClick={() => onSave(r)}><Icon name="heart" size={25} fill={saved ? '#ff385c' : '#0006'} /></button>}
    {picking && <button className="pick-box" aria-pressed={selected} aria-label={`${r.title || '無題'}を${selected ? '比較から外す' : '比較に選ぶ'}`} onClick={() => onSelect(r)}><Icon name="check" size={16} /></button>}
    {photos.length > 1 && <><button className="photo-arrow prev" aria-label="前の写真" onClick={() => setIndex((index + photos.length - 1) % photos.length)}><Icon name="left" size={14} /></button><button className="photo-arrow next" aria-label="次の写真" onClick={() => setIndex((index + 1) % photos.length)}><Icon name="right" size={14} /></button><div className="photo-dots" aria-hidden="true">{photos.slice(0, 5).map((p, i) => <i key={p.path} className={i === Math.min(index, 4) ? 'active' : ''} />)}</div></>}
  </div><a href={href} className="card-copy"><div className="card-location"><strong>{[r.meta?.region, r.meta?.crop].filter(Boolean).join(' · ') || '自分の記録'}</strong>{evidence > 0 && <span>観測 {evidence}</span>}</div><h2>{r.title || '無題の記録'}</h2><Snippet record={r} highlight={highlight} /><div className="card-author">{r.meta?.author || '名前未登録'}{r.meta?.club && ` · ${r.meta.club}`}</div><div className="card-bottom">{metric ? <span><strong>{formatNumber(number(r.meta[metric[0]]))}</strong> {metric[2]}<span className="metric-caption"> / {metric[1]}</span></span> : <time dateTime={r.date}>{r.date.replaceAll('-', '.')}</time>}</div></a>
  {!publicMode && r.meta?.kind === 'challenge' && (r.meta.deadline || r.meta.origin) && <div className="card-meta-line">{r.meta.deadline && <span>振り返る日 {r.meta.deadline.replaceAll('-', '.')}</span>}{r.meta.origin && <span>参考：{r.meta.origin.title || '記録'}</span>}</div>}
  {!publicMode && <div className="card-utility">{publicationLabel === '公開中' ? <a className="published-link" href={`#/record/${r.id}/review`}>公開中</a> : <span>{publicationLabel}</span>}<button className="text-action" aria-pressed={selected} onClick={() => onSelect(r)}><Icon name={selected ? 'check' : 'plus'} size={15} />{selected ? '比較に選択済み' : '比較する'}</button></div>}</article>
}
export default function Catalog({ view, records, total, loading, error, query, onQuery, sort, onSort, region, onRegion, filters = EMPTY_FILTERS, onFilters, onReset, exact = false, onExact, facets = null, ranked = null, countFor, onRelax, searchRef, selectedKeys, keyOf, onSelect, savedIds = [], onSave, activityCounts = {}, owned = [], ownedReady, ready, onCreate, blankCount = 0, onCleanup, children }) {
  const [filterOpen, setFilterOpen] = useState(false)
  const publicMode = view === 'search', active = countFilters(filters)
  const title = view === 'search' ? 'みんなの経営発表' : '自分の実践'
  const searching = query.trim() || region.trim() || active
  // 同義語の展開はその場で明示し、「この語だけ」に切り替えられる（URLの exact=1）。
  const expanded = query.trim() ? expandQuery(query).filter(t => t.expanded.length) : []
  const sortOptions = query.trim() ? SORTS : SORTS.filter(([key]) => key !== 'relevance')
  // 内訳チップ：値が2つ以上あるとき、または選択中のとき（外せるように）に出す。
  const chips = (label, list, current, apply) => {
    const isOn = f => !!current.trim() && f.value.trim().toLowerCase() === current.trim().toLowerCase()
    return list?.length > 1 || list?.some(isOn) ? <div className="kind-chips facet-chips" role="group" aria-label={label}>{list.map(f => <button key={f.value} aria-pressed={isOn(f)} onClick={() => apply(isOn(f) ? '' : f.value)}>{f.value}<b>{f.count}</b></button>)}</div> : null
  }
  return <section className="catalog">
    {SEARCH_ENABLED && <><div className="search-area"><SearchPill query={query} onQuery={onQuery} region={region} onRegion={onRegion} active={active} searchRef={searchRef} onFilter={() => setFilterOpen(true)} crops={facets?.crops?.map(f => f.value) || []} regions={facets?.regions?.map(f => f.value) || []}
      onSubmit={() => { document.getElementById('catalog-results')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); document.getElementById('catalog-results')?.focus({ preventScroll: true }) }} /></div>
    <div className="browse-controls"><button className="filter-button" onClick={() => setFilterOpen(true)}><Icon name="filter" size={18} /><span>絞り込み{active ? ` · ${active}` : ''}</span></button></div></>}
    <div className="page-heading" id="catalog-results" tabIndex={-1}><div><h1>{searching ? `${title}の検索結果` : title}</h1></div><div className="result-tools"><span>{loading ? '読み込み中' : `${total}件`}</span><select aria-label="並び順" value={sort} onChange={e => onSort(e.target.value)}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
    {SEARCH_ENABLED && expanded.length > 0 && (exact
      ? <p className="search-note">同義語を含めず、入力した語だけで探しています。<button className="text-action" onClick={() => onExact?.(false)}>同義語も含める</button></p>
      : <p className="search-note">{expanded.map(t => <span key={t.term}>「{t.term}」は{t.expanded.map(w => `「${w}」`).join('')}も含めて探しています。</span>)}<button className="text-action" onClick={() => onExact?.(true)}>入力した語だけで探す</button></p>)}
    {publicMode && sort === 'relevance' && ranked === 'page' && !loading && total > records.length && <p className="search-note">関連度順は、このページに読み込んだ{records.length}件の中での並べ替えです。</p>}
    {publicMode && !loading && <>{chips('作物で絞り込む', facets?.crops, filters.crop, value => onFilters({ ...filters, crop: value }))}{chips('地域で絞り込む', facets?.regions, region, onRegion)}</>}
    {view === 'mine' && <div className="workspace-links"><button className="text-action" disabled={!ready} onClick={onCreate}>新しい発表をつくる</button>{blankCount > 0 && <button className="text-action" disabled={!ready} onClick={onCleanup}>空の記録を整理（{blankCount}件）</button>}</div>}
    {view === 'mine' && <div className="kind-chips" role="group" aria-label="分類で絞り込む">{[['all', 'すべて'], ['presentation', '発表'], ['challenge', '挑戦'], ['learning', '学習ノート'], ['trouble', 'トラブル']].map(([key, label]) => <button key={key} aria-pressed={filters.kind === key} onClick={() => onFilters({ ...filters, kind: key, stage: key === 'challenge' ? filters.stage : 'all' })}>{label}</button>)}</div>}
    {view === 'mine' && filters.kind === 'challenge' && <div className="kind-chips stage-chips" role="group" aria-label="進捗で絞り込む">{[['all', 'すべての進捗'], ...PHASES.map(p => [p, p])].map(([key, label]) => <button key={key} aria-pressed={filters.stage === key} onClick={() => onFilters({ ...filters, stage: key })}>{label}</button>)}</div>}
    {error}
    {loading ? <div className="loading-grid" role="status" aria-label="記録を読み込み中">{[0, 1, 2, 3, 4, 5].map(i => <div className="card-skeleton" key={i}><div /><span /><span /></div>)}</div> : records.length ? <div className="record-grid">{records.map(r => <RecordCard key={r.id} record={r} href={`#/${publicMode ? 'public' : 'record'}/${r.id}`} selected={selectedKeys.includes(keyOf(r))} onSelect={onSelect} publicMode={publicMode} saved={savedIds.includes(r.id)} onSave={onSave} highlight={query.trim() ? { query, exact } : null} newCount={publicMode ? 0 : activityCounts[r.id] || 0} publicationLabel={owned.some(p => p.id === r.id && p.is_public) ? '公開中' : ownedReady ? '自分だけ' : '公開状態未確認'} />)}</div>
      : !error && <Empty title={searching ? '一致する記録がありません' : publicMode ? '最初の経営発表を掲載しよう' : 'ひとつ目の記録をつくろう'} action={searching ? <button className="secondary" onClick={onReset}>条件をクリア</button> : <button className="primary" disabled={!ready} onClick={onCreate}>記録を書き始める</button>}>{searching ? '短い単語や、別の条件で探してみてください。' : '写真や数字、気づいたことから残せます。'}</Empty>}
    {publicMode && !loading && !error && !records.length && searching && <Relaxations state={{ query, region, filters, exact }} countFor={countFor} onRelax={onRelax} />}
    {children}
    {filterOpen && <FilterDialog filters={filters} onApply={onFilters} onClose={() => setFilterOpen(false)} countFor={publicMode && countFor ? f => countFor({ query, region, exact, filters: f }) : null} />}
  </section>
}
