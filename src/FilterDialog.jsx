import React, { useEffect, useState } from 'react'
import { Dialog, Field } from './ui.jsx'
import { EMPTY_FILTERS, DATE_PRESETS, datePreset } from './search.js'
import { KINDS } from './domain.js'
// countFor（任意）：条件案の件数を数える関数。あるときは「◯件を表示」を出す（入力のたびに少し待って数える）。
export default function FilterDialog({ filters, onApply, onClose, countFor = null }) {
  const [draft, setDraft] = useState({ ...filters })
  const [count, setCount] = useState({ n: null, loading: false })
  const patch = value => setDraft(d => ({ ...d, ...value }))
  const invalidDates = draft.from && draft.to && draft.from > draft.to
  const draftKey = JSON.stringify(draft)
  useEffect(() => {
    if (!countFor || invalidDates) return
    let cancelled = false
    setCount(c => ({ ...c, loading: true }))
    const timer = setTimeout(() => countFor(draft).then(n => { if (!cancelled) setCount({ n, loading: false }) }).catch(() => { if (!cancelled) setCount({ n: null, loading: false }) }), 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [draftKey, !!countFor])
  const today = new Date()
  const presetOn = key => { const p = datePreset(key, today); return draft.from === p.from && draft.to === p.to }
  const submitLabel = !countFor || count.n === null && !count.loading ? 'この条件で表示' : count.loading ? '件数を確認中…' : count.n === 0 ? '該当なし（0件）' : `${count.n}件を表示`
  return <Dialog title="絞り込み" onClose={onClose}><form className="filter-form" onSubmit={e => { e.preventDefault(); if (!invalidDates) { onApply(draft); onClose() } }}>
    <section><h3>分類</h3><div className="choice-grid">{[['all', 'すべて'], ...Object.entries(KINDS)].map(([value, label]) => <button key={value} type="button" aria-pressed={draft.kind === value} onClick={() => patch({ kind: value })}>{label}</button>)}</div></section>
    <section><Field label="作物"><input value={draft.crop} maxLength={80} placeholder="例：ブロッコリー" onChange={e => patch({ crop: e.target.value })} /></Field></section>
    <section><h3>記録日</h3><div className="choice-grid date-presets">{DATE_PRESETS.map(([key, label]) => <button key={key} type="button" aria-pressed={presetOn(key)} onClick={() => patch(datePreset(key, today))}>{label}</button>)}</div><div className="fields two"><Field label="開始日"><input type="date" value={draft.from} onChange={e => patch({ from: e.target.value })} /></Field><Field label="終了日"><input type="date" value={draft.to} onChange={e => patch({ to: e.target.value })} /></Field></div>{invalidDates && <p className="validation">終了日は開始日以降にしてください。</p>}</section>
    <section><label className="filter-switch"><span><strong>経営の数字がある記録</strong><small>売上・経費・作業時間・収穫量のいずれか</small></span><input type="checkbox" checked={draft.numbers} onChange={e => patch({ numbers: e.target.checked })} /></label></section>
    <div className="filter-footer"><button className="text-action" type="button" onClick={() => setDraft({ ...EMPTY_FILTERS })}>すべてクリア</button><button className="primary" disabled={!!invalidDates} aria-live="polite">{submitLabel}</button></div>
  </form></Dialog>
}
