import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { getUserPublic, listPublic, listNewActivity } from './community.js'
import { ErrorNotice, Empty } from './ui.jsx'

// 対話ページ：自分の公開発表と保存した発表を、新着の指摘・返信の件数と一緒に一覧する。
// 件数の取得に失敗したときはエラーとして示し、「新着0件」とは表示しない。
export default function Talks({ session, bookmarks, onAccount }) {
  const owner = session?.user.id
  const [state, setState] = useState({ loading: true, error: '', mine: [], saved: [], savedTotal: 0, counts: {} })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!owner || !bookmarks.ready) return
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: '' }))
    ;(async () => {
      try {
        if (bookmarks.error) throw new Error(bookmarks.error)
        const [mine, savedPage] = await Promise.all([
          getUserPublic(owner),
          bookmarks.ids.length ? listPublic({ bookmarkedBy: owner }) : Promise.resolve({ records: [], count: 0 }),
        ])
        const saved = savedPage.records.filter(r => r.publication.owner !== owner)
        const items = [...mine.map(r => ({ id: r.id, since: r.publication.updatedAt })),
          ...bookmarks.rows.filter(b => !mine.some(m => m.id === b.id)).map(b => ({ id: b.id, since: b.savedAt }))]
        const counts = items.length ? await listNewActivity(owner, items) : {}
        if (!cancelled) setState({ loading: false, error: '', mine, saved, savedTotal: savedPage.count, counts })
      } catch (e) { if (!cancelled) setState(s => ({ ...s, loading: false, error: e.message })) }
    })()
    return () => { cancelled = true }
  }, [owner, version, bookmarks.ready, bookmarks.error, bookmarks.ids.join(',')])
  const retry = () => { bookmarks.error ? bookmarks.retry() : setVersion(v => v + 1) }
  const row = r => <a className="talk-row" key={r.id} href={`#/public/${r.id}/discussion`}>
    <span className="talk-main"><strong>{r.title || '無題'}</strong><small>{[r.meta?.author, r.meta?.crop].filter(Boolean).join(' · ') || '経営発表'}</small></span>
    {state.counts[r.id] ? <span className="talk-new">新着 {state.counts[r.id]}件</span> : <span className="talk-quiet">新着なし</span>}
    <Icon name="right" size={16} />
  </a>
  if (!owner) return <Empty title="対話を確認するにはログイン" action={<button className="primary" onClick={onAccount}>登録・ログイン</button>}>自分の発表と保存した発表への質問・指摘をここで確認できます。</Empty>
  return <section className="talks-page">
    <h1>対話</h1>
    <p className="hint">自分の発表と保存した発表への質問・指摘・返信を、ここから開けます。</p>
    {state.error ? <ErrorNotice retry={retry}>{state.error}</ErrorNotice> : state.loading || !bookmarks.ready ? <p className="loading" role="status">対話を読み込み中…</p> : <>
      <h2>自分の発表</h2>
      {state.mine.length ? <div className="talk-list">{state.mine.map(row)}</div> : <p className="hint">公開中の発表はまだありません。「自分の実践」から発表を公開すると、届いた指摘がここに並びます。</p>}
      <h2>保存した発表</h2>
      {state.saved.length ? <div className="talk-list">{state.saved.map(row)}</div> : <p className="hint">保存した発表はまだありません。「探す」でハートを付けると、その発表の対話を追えます。</p>}
      {state.savedTotal > state.saved.length && <p className="hint">保存した発表のうち、更新が新しい{state.saved.length}件を表示しています。すべては「保存」から開けます。</p>}
    </>}
  </section>
}
