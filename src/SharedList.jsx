import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { RecordCard } from './Catalog.jsx'
import { getSharedList } from './community.js'
import { Empty, ErrorNotice } from './ui.jsx'
// 共有リンクの閲覧ページ（#/list/:token）。リンクを知っている人は誰でも読める。
// 取得エラーは空リストとして見せず、再試行を出す。null は無効なリンクか共有停止。
export default function SharedList({ token, savedIds, onSave, keyOf, selectedKeys, onSelect }) {
  const [state, setState] = useState({ loading: true, error: '', data: undefined }), [version, setVersion] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: '', data: undefined })
    getSharedList(token).then(data => { if (!cancelled) setState({ loading: false, error: '', data }) }).catch(e => { if (!cancelled) setState({ loading: false, error: e.message, data: undefined }) })
    return () => { cancelled = true }
  }, [token, version])
  return <section className="saved-page shared-page">
    <div className="saved-topbar print-hidden"><a className="round-button" href="#/discover" aria-label="みんなの発表へ"><Icon name="left" size={16} /></a></div>
    {state.loading ? <p className="loading" role="status">共有リストを読み込み中…</p>
      : state.error ? <ErrorNotice retry={() => setVersion(v => v + 1)}>{state.error}</ErrorNotice>
      : !state.data ? <Empty title="このリンクは無効か、共有が停止されています" action={<a className="secondary" href="#/discover">発表を探す</a>}>リストの作成者が共有を停止した場合、以前のリンクは使えません。</Empty>
      : <>
        <header className="saved-heading"><h1>{state.data.name}</h1><p className="shared-note"><Icon name="share" size={14} />共有リスト · リンクを知っている人は誰でも閲覧できます。作成者のメモや、公開停止された発表は含まれません。</p></header>
        {state.data.records.length ? <div className="record-grid">{state.data.records.map(r => <RecordCard key={r.id} record={r} href={`#/public/${r.id}`} publicMode selected={selectedKeys.includes(keyOf(r))} onSelect={onSelect} saved={savedIds.includes(r.id)} onSave={onSave} />)}</div>
          : <div className="saved-empty"><h2>共有中ですが、公開中の発表はまだありません</h2><p>作成者がこのリストに公開中の発表を入れると、ここに並びます。</p></div>}
      </>}
  </section>
}
