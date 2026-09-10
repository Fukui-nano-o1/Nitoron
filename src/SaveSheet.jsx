import React, { useState } from 'react'
import Icon from './Icon.jsx'
import { Dialog, ErrorNotice } from './ui.jsx'
import { LIST_NAME_MAX } from './community.js'
// 保存先シート：保存済みの発表でハートを押したときに開く。リストへの出し入れ、新しいリスト、「すべての保存」からの解除。
export default function SaveSheet({ record, lists, onUnsave, onClose }) {
  const [creating, setCreating] = useState(false), [name, setName] = useState(''), [busy, setBusy] = useState('')
  const member = lists.listsOf(record.id)
  const toggle = async list => {
    setBusy(list.id)
    try { await (member.includes(list.id) ? lists.removeItem(list.id, record.id) : lists.add(list.id, record.id)) } finally { setBusy('') }
  }
  const create = async e => {
    e.preventDefault()
    setBusy('new')
    try { const list = await lists.create(name); if (list) { await lists.add(list.id, record.id); setName(''); setCreating(false) } } finally { setBusy('') }
  }
  return <Dialog title="保存先" onClose={onClose}>
    <p className="hint save-sheet-title">{record.title || '無題の記録'} · 「すべての保存」に保存済み</p>
    {lists.error && <ErrorNotice retry={lists.retry}>{lists.error}</ErrorNotice>}
    <div className="action-list save-sheet">
      {lists.lists.map(list => <button key={list.id} className="action-row" aria-pressed={member.includes(list.id)} disabled={!!busy || !lists.ready} onClick={() => toggle(list)}>
        <span className="action-icon"><Icon name={member.includes(list.id) ? 'check' : 'book'} size={20} /></span>
        <span><strong>{list.name}</strong><small>{lists.countOf(list.id)}件{list.is_shared ? ' · 共有中' : ''}</small></span>
      </button>)}
      {creating ? <form className="action-memo" onSubmit={create}>
        <input aria-label="新しいリストの名前" maxLength={LIST_NAME_MAX} value={name} onChange={e => setName(e.target.value)} placeholder="例：来年試したい育苗" autoFocus />
        <div className="dialog-actions"><button type="button" className="quiet" onClick={() => setCreating(false)}>やめる</button><button className="secondary" disabled={!name.trim() || !!busy}>{busy === 'new' ? '作成中…' : '作成してここに保存'}</button></div>
      </form> : <button className="action-row" disabled={!lists.ready} onClick={() => setCreating(true)}><span className="action-icon"><Icon name="plus" size={20} /></span><span><strong>新しいリスト</strong><small>非公開で作成します。</small></span></button>}
    </div>
    <div className="dialog-actions"><button className="text-action unsave" disabled={!!busy} onClick={onUnsave}><Icon name="heart" size={16} fill="currentColor" />すべての保存から外す（全リストからも外れます）</button></div>
  </Dialog>
}
