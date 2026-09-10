import React, { useEffect, useState } from 'react'
import { listPublic } from './community.js'
import { RecordCard, SearchPill } from './Catalog.jsx'
import FilterDialog from './FilterDialog.jsx'
import { ErrorNotice, Empty } from './ui.jsx'
import { EMPTY_FILTERS, paramsFromList } from './search.js'

// ホームのテーマ行。作物の行はcrop条件、課題の行はキーワード（q）条件で絞り、
// 「すべて見る」も同じ条件を検索結果ページへ引き継ぐ。新着行は条件なしの新しい順。
const BASE = { query: '', region: '', filters: EMPTY_FILTERS, sort: 'recent', page: 0 }
export const HOME_ROWS = [
  { key: 'recent', label: '新着の発表', state: BASE },
  ...['ブロッコリー', 'トマト', '水稲'].map(crop => ({ key: `crop:${crop}`, label: crop, state: { ...BASE, filters: { ...EMPTY_FILTERS, crop } } })),
  ...['育苗', '土づくり', '省力化'].map(word => ({ key: `q:${word}`, label: word, state: { ...BASE, query: word } })),
]
export const searchHref = state => { const qs = paramsFromList(state); return `#/search${qs ? `?${qs}` : ''}` }
const ROW_LIMIT = 12

// 各行の読み込みとエラーは独立させ、1行の失敗でホーム全体を止めない。
function HomeRow({ row, renderCard }) {
  const [state, setState] = useState({ loading: true, error: '', records: [], count: 0 })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: '' }))
    listPublic({ ...row.state, limit: ROW_LIMIT })
      .then(data => { if (!cancelled) setState({ ...data, loading: false, error: '' }) })
      .catch(e => { if (!cancelled) setState({ records: [], count: 0, loading: false, error: e.message }) })
    return () => { cancelled = true }
  }, [row.key, version])
  // 該当0件のテーマ行は表示しない。新着行だけは全体の空状態を伝えるために残す。
  if (!state.loading && !state.error && !state.records.length && row.key !== 'recent') return null
  return <section className="home-row" aria-label={row.label}>
    <div className="home-row-head"><h2>{row.label}</h2><a href={searchHref(row.state)}>すべて見る</a></div>
    {state.error ? <ErrorNotice retry={() => setVersion(v => v + 1)}>{state.error}</ErrorNotice>
      : state.loading ? <div className="home-row-scroll" role="status" aria-label={`${row.label}を読み込み中`}>{[0, 1, 2, 3].map(i => <div className="card-skeleton" key={i}><div /><span /><span /></div>)}</div>
      : state.records.length ? <div className="home-row-scroll">{state.records.map(renderCard)}</div>
      : <Empty title="最初の経営発表を掲載しよう">公開された発表がここに並びます。「自分の実践」から発表を公開できます。</Empty>}
  </section>
}

export default function Home({ savedIds, onSave, keyOf, selectedKeys, onSelect, searchRef }) {
  const [query, setQuery] = useState(''), [region, setRegion] = useState(''), [filterOpen, setFilterOpen] = useState(false)
  // 検索確定・条件適用の時点で結果ページへ移動する（入力中は履歴もURLも変えない）。
  const go = (filters = EMPTY_FILTERS) => { location.hash = searchHref({ ...BASE, query, region, filters }) }
  const renderCard = r => <RecordCard key={r.id} record={r} href={`#/public/${r.id}`} publicMode selected={selectedKeys.includes(keyOf(r))} onSelect={onSelect} saved={savedIds.includes(r.id)} onSave={onSave} />
  return <section className="catalog">
    <div className="search-area"><SearchPill query={query} onQuery={setQuery} region={region} onRegion={setRegion} searchRef={searchRef} onFilter={() => setFilterOpen(true)} onSubmit={go} /></div>
    <div className="home-rows">{HOME_ROWS.map(row => <HomeRow key={row.key} row={row} renderCard={renderCard} />)}</div>
    {filterOpen && <FilterDialog filters={EMPTY_FILTERS} onApply={go} onClose={() => setFilterOpen(false)} />}
  </section>
}
