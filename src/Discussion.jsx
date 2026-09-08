import React, { useEffect, useRef, useState } from 'react'
import { FEEDBACK_KINDS, listFeedback, postFeedback, deleteFeedback, listReplies, postReply, deleteReply, listResolutions, setResolution } from './community.js'
import { SECTIONS } from './domain.js'
import { Field, ErrorNotice, download } from './ui.jsx'

export default function Discussion({ record, session, name, onAccount, onLearn }) {
  const [items, setItems] = useState([]), [replies, setReplies] = useState([]), [resolutions, setResolutions] = useState([])
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [author, setAuthor] = useState(name || ''), [kind, setKind] = useState('質問'), [section, setSection] = useState('全体'), [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState(''), [replyBody, setReplyBody] = useState(''), [showForm, setShowForm] = useState(false)
  const epoch = useRef(0)
  const load = async () => {
    const token = ++epoch.current
    setLoading(true); setError('')
    try {
      const [comments, responses, states] = await Promise.all([listFeedback(record.id), listReplies(record.id), listResolutions(record.id)])
      if (token === epoch.current) { setItems(comments); setReplies(responses); setResolutions(states) }
    } catch (e) { if (token === epoch.current) setError(e.message) }
    finally { if (token === epoch.current) setLoading(false) }
  }
  useEffect(() => { setItems([]); setReplies([]); setResolutions([]); setReplyTo(''); setReplyBody(''); setBody(''); setAuthor(name || ''); load(); return () => { epoch.current++ } }, [record.id, session?.user.id, record.publication?.isPublic])
  const run = async action => { setBusy(true); setError(''); try { await action(); await load() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const verified = session?.user && !session.user.is_anonymous && session.user.email_confirmed_at
  const owner = session?.user.id === record.publication?.owner
  const visible = record.publication?.isPublic !== false
  return <section id="discussion" className="discussion print-hidden">
    <div className="discussion-title"><h2>質問・指摘 <span>· {items.length}{items.length === 100 ? '+' : ''}</span></h2>{visible && <button className="secondary" onClick={() => verified ? setShowForm(!showForm) : onAccount()}>投稿する</button>}</div>
    {error && <ErrorNotice retry={load}>{error}</ErrorNotice>}
    {loading ? <p role="status">読み込み中…</p> : <>
      {!items.length && !error && <p className="hint">気になる条件や、試した結果を話し合えます。</p>}
      <div className="feedback-grid">{items.map(item => {
        const status = resolutions.find(r => r.feedback_id === item.id)?.status || '未対応'
        return <article className="feedback" key={item.id}>
          <div className="feedback-person"><span className="avatar-circle">{item.author.slice(0, 1)}</span><div><strong>{item.author}</strong><time>{item.created_at.slice(0, 10)}</time></div></div>
          <div className="feedback-tags"><span>{item.kind}</span><span>{item.section}</span><span className={`resolution ${status === '対応済み' ? 'resolved' : ''}`}>{status}</span></div>
          <p>{item.body}</p>
          <div className="feedback-actions">{visible && <button className="text-action" onClick={() => { if (!verified) onAccount(); else { setReplyTo(replyTo === item.id ? '' : item.id); setReplyBody('') } }}>返信する</button>}{onLearn && <button className="text-action" onClick={() => onLearn(item)}>学びに残す</button>}
            {(owner || session?.user.id === item.user_id) && <button className="text-action" disabled={busy} onClick={() => { if (window.confirm('投稿と返信を削除しますか？')) run(() => deleteFeedback(item.id)) }}>削除</button>}
            {owner && <select aria-label={`${item.author}の投稿への対応状況`} value={status} disabled={busy} onChange={e => run(() => setResolution(record.id, item.id, session, e.target.value))}>{['未対応', '検討中', '対応済み'].map(s => <option key={s}>{s}</option>)}</select>}
          </div>
          {replies.filter(r => r.feedback_id === item.id).map(reply => <div className="reply" key={reply.id}><div><strong>{reply.author}</strong><time>{reply.created_at.slice(0, 10)}</time>{reply.user_id === record.publication?.owner && <span>発表者</span>}</div><p>{reply.body}</p>{(owner || session?.user.id === reply.user_id) && <button className="text-action" disabled={busy} onClick={() => { if (window.confirm('この返信を削除しますか？')) run(() => deleteReply(reply.id)) }}>削除</button>}</div>)}
          {replyTo === item.id && verified && <form className="reply-form" onSubmit={e => { e.preventDefault(); run(async () => { await postReply(record.id, item.id, session, { author, body: replyBody }); setReplyTo(''); setReplyBody('') }) }}><Field label="表示名"><input required maxLength={80} value={author} onChange={e => setAuthor(e.target.value)} /></Field><Field label="返信"><textarea required rows={3} maxLength={4000} value={replyBody} onChange={e => setReplyBody(e.target.value)} /></Field><button className="primary" disabled={busy}>返信を送る</button></form>}
        </article>
      })}</div>
      {(items.length === 100 || replies.length === 500) && <p className="hint">投稿は最新100件、返信は先頭500件まで表示しています。</p>}
      {!!items.length && <button className="text-action" onClick={() => download(`${record.title}_対話.json`, JSON.stringify({ feedback: items.map(({ id, author, kind, section, body, created_at }) => ({ id, author, kind, section, body, created_at })), replies: replies.map(({ feedback_id, author, body, created_at }) => ({ feedback_id, author, body, created_at })), resolutions: resolutions.map(({ feedback_id, status }) => ({ feedback_id, status })) }, null, 2), 'application/json')}>表示中の対話を書き出す</button>}
    </>}
    {!visible && <p className="notice">公開停止中です。これまでの対話は保管されています。</p>}
    {showForm && visible && verified && <form className="feedback-form" onSubmit={e => { e.preventDefault(); run(async () => { await postFeedback(record.id, session, { author, kind, section, body }); setBody(''); setShowForm(false) }) }}>
      <div className="fields two"><Field label="種類"><select value={kind} onChange={e => setKind(e.target.value)}>{FEEDBACK_KINDS.map(k => <option key={k}>{k}</option>)}</select></Field><Field label="対象"><select value={section} onChange={e => setSection(e.target.value)}><option>全体</option>{SECTIONS.map(([, label]) => <option key={label}>{label}</option>)}</select></Field></div>
      <Field label="表示名"><input required maxLength={80} value={author} onChange={e => setAuthor(e.target.value)} /></Field>
      <Field label="内容" help="投稿と返信は発表と一緒に公開されます。"><textarea rows={4} required maxLength={4000} value={body} onChange={e => setBody(e.target.value)} placeholder="どの結果について、何を確かめたいですか？" /></Field><button className="primary" disabled={busy}>{busy ? '投稿中…' : '投稿する'}</button>
    </form>}
  </section>
}
