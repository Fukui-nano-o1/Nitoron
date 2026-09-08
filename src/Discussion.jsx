import React, { useEffect, useState } from 'react'
import { FEEDBACK_KINDS, listFeedback, postFeedback, deleteFeedback } from './community.js'
import { SECTIONS } from './domain.js'
import { Field, ErrorNotice, download } from './ui.jsx'
export default function Discussion({ record, session, name, onAccount }) {
  const [items, setItems] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [body, setBody] = useState(''), [kind, setKind] = useState('質問'), [section, setSection] = useState('全体')
  const [author, setAuthor] = useState(name), [busy, setBusy] = useState(false)
  const load = async () => { setLoading(true); setError(''); try { setItems(await listFeedback(record.id)) } catch (e) { setError(e.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [record.id])
  const verified = session?.user && !session.user.is_anonymous && session.user.email_confirmed_at
  return <section className="discussion print-hidden"><div className="section-heading"><span className="section-number">DIALOGUE</span><h2>質問・指摘から深める</h2></div>
    {error && <ErrorNotice retry={load}>{error}</ErrorNotice>}
    {loading ? <p role="status">指摘を読み込み中…</p> : <>
      {!items.length && !error && <p className="hint">気になった条件、別の見方、試した結果を残せます。</p>}
      {items.map(item => <article className="feedback" key={item.id}><div className="feedback-head"><strong>{item.author}</strong><span className="chip">{item.kind}</span><span>{item.section}</span><time>{item.created_at.slice(0, 10)}</time></div><p>{item.body}</p>
        {(session?.user.id === item.user_id || session?.user.id === record.publication.owner) && <button className="quiet" disabled={busy} onClick={async () => { if (!window.confirm('この投稿を削除しますか？')) return; setBusy(true); try { await deleteFeedback(item.id); await load() } catch (e) { setError(e.message) } finally { setBusy(false) } }}>削除</button>}
      </article>)}
      {items.length === 100 && <p className="hint">最新100件を表示しています。</p>}
      {!!items.length && <button className="quiet" onClick={() => download(`${record.title}_指摘.json`, JSON.stringify(items.map(({ author, kind, section, body, created_at }) => ({ author, kind, section, body, created_at })), null, 2), 'application/json')}>表示中の指摘を書き出す</button>}
    </>}
    {record.publication.isPublic === false ? <p className="notice">公開を停止しています。これまでの指摘はここから確認できます。</p> : verified ? <form className="feedback-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await postFeedback(record.id, session, { author, kind, section, body }); setBody(''); await load() } catch (err) { setError(err.message) } finally { setBusy(false) } }}>
      <div className="fields two"><Field label="投稿の種類"><select value={kind} onChange={e => setKind(e.target.value)}>{FEEDBACK_KINDS.map(k => <option key={k}>{k}</option>)}</select></Field><Field label="対象"><select value={section} onChange={e => setSection(e.target.value)}><option>全体</option>{SECTIONS.map(([, label]) => <option key={label}>{label}</option>)}</select></Field></div>
      <Field label="表示名"><input required maxLength={80} value={author} onChange={e => setAuthor(e.target.value)} /></Field>
      <Field label="内容" help="この発表と一緒に公開されます。条件や根拠を添えて、内容について具体的に。"><textarea rows={4} required maxLength={4000} value={body} onChange={e => setBody(e.target.value)} placeholder="どの結果について、何を確かめたいですか？" /></Field>
      <button className="primary" disabled={busy}>{busy ? '投稿中…' : '投稿する'}</button>
    </form> : <button className="secondary" onClick={onAccount}>メールを登録して投稿</button>}
  </section>
}
