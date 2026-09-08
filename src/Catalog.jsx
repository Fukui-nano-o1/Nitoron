import React from 'react'
import Cover from './Cover.jsx'
import { KINDS, number, formatNumber } from './domain.js'
import { Empty } from './ui.jsx'

const topics = ['すべて', 'ブロッコリー', 'トマト', '水稲', '育苗', '土づくり', '省力化']
export function RecordCard({ record: r, href, selected, onSelect, publicMode, publicationLabel }) {
  const evidence = r.meta?.observations?.filter(o => o.fact.trim()).length || 0
  const metric = [['hours', '作業時間', '時間'], ['yieldKg', '収穫量', 'kg'], ['revenue', '売上', '円']].find(([key]) => number(r.meta?.[key]) !== null)
  return <article className="record-card">
    <div className="card-visual"><a href={href} className="cover-link" tabIndex={-1} aria-hidden="true"><Cover record={r} /></a>
      <span className="card-badge">{r.meta?.kind === 'challenge' ? r.meta.stage : KINDS[r.meta?.kind || 'memo']}</span>
      <button className="compare-toggle" aria-pressed={selected} aria-label={`${r.title || '無題の記録'}を${selected ? '比較から外す' : '比較に追加'}`} onClick={() => onSelect(r)}>{selected ? '選択済み' : '比較 ＋'}</button>
    </div>
    <a href={href} className="card-copy"><div className="card-location"><span>{[r.meta?.region, r.meta?.crop].filter(Boolean).join(' · ') || '自分の記録'}</span>{evidence > 0 && <span className="evidence-count">観測 {evidence}</span>}</div>
      <h2>{r.title || '無題の記録'}</h2><p>{r.meta?.summary || r.blocks.map(b => b.text).join(' ') || '気づいたことから、書き始める。'}</p>
      <div className="card-author">{r.meta?.author || '名前未登録'}{r.meta?.club && ` · ${r.meta.club}`}</div>
      <div className="card-bottom">{metric ? <span><strong>{formatNumber(number(r.meta[metric[0]]))}</strong> {metric[2]}<span className="metric-caption"> / {metric[1]}</span></span> : <time dateTime={r.date}>{r.date.replaceAll('-', '.')}</time>}{!publicMode && <span className="privacy-label">{publicationLabel}</span>}</div>
    </a>
  </article>
}

export default function Catalog({ view, records, total, loading, error, query, onQuery, filter, onFilter, sort, onSort, region, onRegion, searchRef, selectedKeys, keyOf, onSelect, owned, ownedReady, ready, onCreate, children }) {
  const publicMode = view === 'discover'
  const title = publicMode ? 'みんなの経営発表' : view === 'challenges' ? '次の挑戦' : view === 'learning' ? '学習ノート' : '自分の記録'
  const searching = query.trim() || region.trim()
  return <section className="catalog">
    <div className="search-area"><div className="search-pill" role="search" aria-label="記録を検索">
      <label className="search-part"><span>何を知りたい？</span><input ref={searchRef} type="search" value={query} onChange={e => onQuery(e.target.value)} placeholder="作物、課題、気になる言葉" /></label>
      <label className="region-part"><span>どこで？</span><input type="search" value={region} onChange={e => onRegion(e.target.value)} placeholder="すべての地域" aria-label="地域を検索" /></label>
      <button className="search-submit" onClick={() => { document.getElementById('catalog-results')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); document.getElementById('catalog-results')?.focus({ preventScroll: true }) }}>検索</button>
    </div></div>
    <div className="browse-controls"><div className="topic-tabs" aria-label="テーマで探す">{topics.map(topic => <button key={topic} aria-pressed={topic === 'すべて' ? !query : query === topic} onClick={() => onQuery(topic === 'すべて' ? '' : topic)}>{topic}</button>)}</div>
      {view === 'mine' && <label className="kind-filter"><span className="sr-only">記録の種類</span><select value={filter} onChange={e => onFilter(e.target.value)}><option value="all">すべての種類</option>{Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
    </div>
    <div className="page-heading" id="catalog-results" tabIndex={-1}><div><h1>{searching ? '検索結果' : title}</h1><p>{searching ? [query, region].filter(Boolean).join(' · ') : publicMode ? '実践したこと、分かったこと。その先の挑戦。' : view === 'challenges' ? '仮説を立てて、確かめてみる。' : view === 'learning' ? '次の判断に、つながる気づき。' : '公開するまでは、自分だけの記録。'}</p></div>
      <div className="result-tools"><span>{loading ? '読み込み中' : `${total}件`}</span>{!publicMode && <select aria-label="並び順" value={sort} onChange={e => onSort(e.target.value)}><option value="recent">新しい順</option><option value="title">タイトル順</option></select>}</div>
    </div>
    {error}
    {loading ? <div className="loading-grid" role="status" aria-label="記録を読み込み中">{[0, 1, 2, 3].map(i => <div className="card-skeleton" key={i}><div /><span /><span /></div>)}</div>
      : records.length ? <div className="record-grid">{records.map(r => <RecordCard key={r.id} record={r} href={`#/${publicMode ? 'public' : 'record'}/${r.id}`} selected={selectedKeys.includes(keyOf(r))} onSelect={onSelect} publicMode={publicMode} publicationLabel={owned.some(p => p.id === r.id && p.is_public) ? '公開中' : ownedReady ? '自分だけ' : '公開状態未確認'} />)}</div>
      : !error && <Empty title={searching ? '一致する記録がありません' : publicMode ? '最初の発表を、ここから。' : 'ひとつ目の記録をつくろう。'} action={searching ? <button className="secondary" onClick={() => { onQuery(''); onRegion('') }}>検索をクリア</button> : <button className="primary" disabled={!ready} onClick={onCreate}>記録を書き始める</button>}>{searching ? '短い単語や、別の表現で探してみてください。' : '試したこと、気づいたこと。途中でも残せます。'}</Empty>}
    {children}
  </section>
}
