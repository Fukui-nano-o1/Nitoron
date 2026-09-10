import React from 'react'
import Icon from './Icon.jsx'
import { RecordCard } from './Catalog.jsx'
import { PAGE_SIZE } from './community.js'

export default function SavedList({ session, records, count, loading, error, page, onPage, savedIds, onSave, activityCounts = {}, keyOf, selectedKeys, onSelect, onAccount }) {
  const signedOut = !session
  return <section className="saved-page">
    <div className="saved-topbar print-hidden"><a className="round-button" href="#/discover" aria-label="みんなの発表へ戻る"><Icon name="left" size={16} /></a></div>
    <header className="saved-heading">
      <h1>保存リスト</h1>
      {!signedOut && <p>{loading ? '読み込み中' : `保存済みの発表 ${count}件`} · 公開中の発表だけが表示されます。</p>}
    </header>
    {error}
    {signedOut ? <div className="saved-empty">
      <h2>ログインすると保存リストを表示できます</h2>
      <p>ハートを付けた発表を、どの端末からでも読み返せます。</p>
      <button className="primary" onClick={onAccount}>ログイン</button>
    </div>
    : loading ? <div className="loading-grid" role="status" aria-label="保存リストを読み込み中">{[0, 1, 2, 3, 4, 5, 6, 7].map(i => <div className="card-skeleton" key={i}><div /><span /><span /></div>)}</div>
    : records.length ? <>
      <div className="record-grid">{records.map(r => <RecordCard key={r.id} record={r} href={`#/public/${r.id}`} publicMode selected={selectedKeys.includes(keyOf(r))} onSelect={onSelect} saved={savedIds.includes(r.id)} onSave={onSave} newCount={activityCounts[r.id] || 0} />)}</div>
      {count > PAGE_SIZE && <div className="pagination"><button className="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>前へ</button><span>{page + 1} / {Math.ceil(count / PAGE_SIZE)}</span><button className="secondary" disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => onPage(page + 1)}>次へ</button></div>}
    </>
    : !error && <div className="saved-empty">
      <h2>まだ保存がありません</h2>
      <p>発表を探しているときにハートを押すと、お気に入りがここに集まります。</p>
      <a className="primary" href="#/discover">発表をさがす</a>
    </div>}
  </section>
}
