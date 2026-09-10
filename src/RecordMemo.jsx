import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { getCardMemo, saveCardMemo } from './community.js'

// 発表詳細の「自分だけのメモ」。nitoron_card_memos に本人だけが読める形で保存する（旧カードメニューから移設）。
export default function RecordMemo({ record, session, onAccount, notify }) {
  const [open, setOpen] = useState(false), [memo, setMemo] = useState(''), [saved, setSaved] = useState('')
  const [status, setStatus] = useState(session ? '読み込み中…' : ''), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!session) return
    let cancelled = false
    getCardMemo(session.user.id, record.id)
      .then(body => { if (!cancelled) { setMemo(body); setSaved(body); setStatus(''); if (body) setOpen(true) } })
      .catch(e => { if (!cancelled) setStatus(e.message) })
    return () => { cancelled = true }
  }, [session?.user.id, record.id])
  const submit = async e => {
    e.preventDefault()
    setBusy(true); setStatus('')
    try {
      const body = await saveCardMemo(session.user.id, record.id, memo)
      setMemo(body); setSaved(body); notify(body ? 'メモを保存しました。自分だけが読めます。' : 'メモを削除しました。')
    } catch (err) { setStatus(err.message) } finally { setBusy(false) }
  }
  return <>
    <button className="action-row" aria-expanded={open} onClick={() => session ? setOpen(!open) : onAccount()}>
      <span className="action-icon"><Icon name="pencil" size={20} /></span>
      <span><strong>自分だけのメモ</strong><small>{session ? saved ? 'メモがあります。開いて編集できます。' : '気づきを残せます。公開されません。' : 'ログインするとメモを保存できます。'}</small></span>
    </button>
    {open && session && <form className="action-memo" onSubmit={submit}>
      <textarea aria-label="自分だけのメモ" rows={4} maxLength={2000} value={memo} onChange={e => setMemo(e.target.value)} placeholder="この発表から試したいこと、確認したい条件など" />
      {status && <p className="hint" role="status">{status}</p>}
      <button className="secondary" disabled={busy || memo.trim() === saved}>{busy ? '保存中…' : saved && !memo.trim() ? 'メモを削除' : 'メモを保存'}</button>
    </form>}
  </>
}
