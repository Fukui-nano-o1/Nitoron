import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { Dialog } from './ui.jsx'
import { getCardMemo, saveCardMemo } from './community.js'

// カードの三本線メニュー。Airbnbの保存・メニューシートを参考にした操作一覧。
export default function CardMenu({ record, session, saved, onSave, following, onFollow, onClose, onAccount, notify }) {
  const ownerId = record.publication?.owner
  const author = record.meta?.author || '発表者'
  const self = !!session && session.user.id === ownerId
  const [memoOpen, setMemoOpen] = useState(false), [memo, setMemo] = useState(''), [memoSaved, setMemoSaved] = useState('')
  const [memoStatus, setMemoStatus] = useState(session ? '読み込み中…' : ''), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!session) return
    let cancelled = false
    getCardMemo(session.user.id, record.id)
      .then(body => { if (!cancelled) { setMemo(body); setMemoSaved(body); setMemoStatus(''); if (body) setMemoOpen(true) } })
      .catch(e => { if (!cancelled) setMemoStatus(e.message) })
    return () => { cancelled = true }
  }, [session?.user.id, record.id])
  const submitMemo = async e => {
    e.preventDefault()
    setBusy(true); setMemoStatus('')
    try {
      const body = await saveCardMemo(session.user.id, record.id, memo)
      setMemo(body); setMemoSaved(body); notify(body ? 'メモを保存しました。自分だけが読めます。' : 'メモを削除しました。')
    } catch (err) { setMemoStatus(err.message) } finally { setBusy(false) }
  }
  return <Dialog title={record.title || '無題の記録'} onClose={onClose}>
    <div className="card-menu">
      <p className="card-menu-author"><span className="avatar-circle" aria-hidden="true">{author.slice(0, 1)}</span>{author}{record.meta?.region ? ` · ${record.meta.region}` : ''}</p>
      <div className="card-menu-list">
        <button className="card-menu-row" onClick={onSave}>
          <span className="card-menu-icon"><Icon name="heart" size={20} fill={saved ? '#ff385c' : 'none'} color={saved ? '#ff385c' : undefined} /></span>
          <span><strong>{saved ? '保存リストから外す' : '保存リストに追加'}</strong><small>{saved ? '保存済みです。どの端末からでも読み返せます。' : 'ハートと同じ保存機能です。'}</small></span>
        </button>
        <button className="card-menu-row" aria-expanded={memoOpen} onClick={() => session ? setMemoOpen(!memoOpen) : onAccount()}>
          <span className="card-menu-icon"><Icon name="pencil" size={20} /></span>
          <span><strong>自分だけのメモ</strong><small>{session ? memoSaved ? 'メモがあります。開いて編集できます。' : '気づきを残せます。公開されません。' : 'ログインするとメモを保存できます。'}</small></span>
        </button>
        {memoOpen && session && <form className="card-menu-memo" onSubmit={submitMemo}>
          <textarea aria-label="自分だけのメモ" rows={4} maxLength={2000} value={memo} onChange={e => setMemo(e.target.value)} placeholder="この発表から試したいこと、確認したい条件など" />
          {memoStatus && <p className="hint" role="status">{memoStatus}</p>}
          <button className="secondary" disabled={busy || memo.trim() === memoSaved}>{busy ? '保存中…' : memoSaved && !memo.trim() ? 'メモを削除' : 'メモを保存'}</button>
        </form>}
        <a className="card-menu-row" href={`#/public/${record.id}/discussion`} onClick={onClose}>
          <span className="card-menu-icon"><Icon name="chat" size={20} /></span>
          <span><strong>質問・指摘を送る</strong><small>発表ページの対話欄へ移動します。</small></span>
        </a>
        {ownerId && !self && <button className="card-menu-row" onClick={onFollow}>
          <span className="card-menu-icon"><Icon name="user-plus" size={20} /></span>
          <span><strong>{following ? `${author}のフォローをやめる` : `${author}をフォローする`}</strong><small>{following ? 'フォロー中です。' : '発表者を覚えておき、次の発表を見つけやすくします。'}</small></span>
        </button>}
        {ownerId && <a className="card-menu-row" href={`#/user/${ownerId}`} onClick={onClose}>
          <span className="card-menu-icon"><Icon name="user" size={20} /></span>
          <span><strong>{author}の発表一覧</strong><small>この発表者のプロフィールを開きます。</small></span>
        </a>}
      </div>
    </div>
  </Dialog>
}
