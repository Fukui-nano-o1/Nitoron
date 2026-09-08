import React, { useState } from 'react'
import { Dialog, Field } from './ui.jsx'
import { EMPTY_FILTERS } from './search.js'
export default function FilterDialog({ filters, onApply, onClose }) {
  const [draft, setDraft] = useState({ ...filters })
  const patch = value => setDraft(d => ({ ...d, ...value }))
  const invalidDates = draft.from && draft.to && draft.from > draft.to
  return <Dialog title="絞り込み" onClose={onClose}><form className="filter-form" onSubmit={e => { e.preventDefault(); if (!invalidDates) { onApply(draft); onClose() } }}>
    <section><Field label="作物"><input value={draft.crop} maxLength={80} placeholder="例：ブロッコリー" onChange={e => patch({ crop: e.target.value })} /></Field></section>
    <section><h3>記録日</h3><div className="fields two"><Field label="開始日"><input type="date" value={draft.from} onChange={e => patch({ from: e.target.value })} /></Field><Field label="終了日"><input type="date" value={draft.to} onChange={e => patch({ to: e.target.value })} /></Field></div>{invalidDates && <p className="validation">終了日は開始日以降にしてください。</p>}</section>
    <section><label className="filter-switch"><span><strong>経営の数字がある記録</strong><small>売上・経費・作業時間・収穫量のいずれか</small></span><input type="checkbox" checked={draft.numbers} onChange={e => patch({ numbers: e.target.checked })} /></label></section>
    <div className="filter-footer"><button className="text-action" type="button" onClick={() => setDraft({ ...EMPTY_FILTERS })}>すべてクリア</button><button className="primary" disabled={!!invalidDates}>この条件で表示</button></div>
  </form></Dialog>
}
