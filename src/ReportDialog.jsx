import React, { useState } from 'react'
import { Dialog, Field, ErrorNotice } from './ui.jsx'
import { postFeedback } from './community.js'
// 元の発表へ「試した結果」を報告する。送信先・公開される本文・添えるリンクを見せ、本人が「送信」を押したときだけ投稿する。
// 自分の挑戦が未公開なら本文だけを報告し、リンクは付けない。送信中は二重送信しない。失敗しても本文は残す。
export default function ReportDialog({ record, origin, session, name, published, onClose, notify }) {
  const m = record.meta
  const [author, setAuthor] = useState(name || m?.author || ''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [body, setBody] = useState(() => [`「${record.title || '無題'}」で試しました。`, m?.result ? `結果：${m.result}` : m?.summary ? `概要：${m.summary}` : '', m?.verdict ? `本人の判定：${m.verdict}` : ''].filter(Boolean).join('\n'))
  const link = published ? `${location.origin}${location.pathname}#/public/${record.id}` : ''
  const send = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      await postFeedback(origin.id, session, { author, kind: '試した結果', section: '結果', body, related: published ? record.id : null })
      notify('元の発表へ結果を報告しました。'); onClose()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <Dialog title="元の発表へ結果を報告" onClose={busy ? () => {} : onClose}>
    <form className="filter-form report-form" onSubmit={send}>
      <p className="hint">送信先：<a href={`#/public/${origin.id}`} target="_blank" rel="noopener noreferrer">{origin.title || '元の発表'}</a> の対話欄に、種類「試した結果」・対象「結果」として公開されます。</p>
      <Field label="表示名"><input required maxLength={80} value={author} onChange={e => setAuthor(e.target.value)} /></Field>
      <Field label="公開される本文"><textarea required rows={6} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} /></Field>
      <p className="hint report-link">{published ? <>添える実践記録リンク：<code>{link}</code>（公開中の自分の挑戦です。公開を停止すると、報告からリンクとタイトルは表示されなくなります）</> : '自分の挑戦は未公開のため、実践記録リンクは付けません。本文だけを報告します。'}</p>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      <div className="dialog-actions"><button type="button" className="quiet" disabled={busy} onClick={onClose}>送信せずに閉じる</button><button className="primary" disabled={busy || !body.trim() || !author.trim()}>{busy ? '送信中…' : 'この内容で送信する'}</button></div>
    </form>
  </Dialog>
}
