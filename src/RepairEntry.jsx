import React, { useEffect, useRef, useState } from 'react'
import { Dialog, Field } from './ui.jsx'
import { REPAIR_OUTCOMES, REPAIR_MACHINE_FIELDS, REPAIR_SYMPTOM_FIELDS, REPAIR_CHECK_FIELDS, REPAIR_ACTION_FIELDS, createRepairEntryDraft, repairProblems, newCheck, newAction, hasRepairContent } from './repair-entry.mjs'

const filled = value => value != null && String(value).trim() !== ''
export const REPAIR_SECTIONS = [['machine', '機械'], ['symptom', '症状'], ['checks', '確認したこと'], ['actions', '行ったこと'], ['outcome', '結果']]

// 修理の内容の表示。本人の記録画面・記録の詳細・公開版で同じ並びを使う。
export function RepairContent({ repair, fallbackSymptom = '', compact = false }) {
  if (!repair) return null
  const r = repair
  const machine = REPAIR_MACHINE_FIELDS.filter(([key]) => filled(r.machine[key]))
  const symptom = REPAIR_SYMPTOM_FIELDS.filter(([key]) => filled(r.symptom[key]))
  const checks = r.checks.filter(c => ['part', 'finding', 'basis'].some(key => filled(c[key])))
  const actions = r.actions.filter(a => ['date', 'what', 'parts', 'cost', 'minutes'].some(key => filled(a[key])))
  const outcome = [['状態', REPAIR_OUTCOMES[r.outcome.status] || ''], ['確認した内容', r.outcome.note], ['次回の確認', r.outcome.recheckOn]].filter(([, value]) => filled(value))
  const symptomText = filled(r.symptom.text) ? r.symptom.text : fallbackSymptom
  return <div className={`repair-content${compact ? ' compact' : ''}`}>
    {!!machine.length && <section className="repair-content-section"><h2>機械</h2><dl>{machine.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{r.machine[key]}</dd></div>)}</dl></section>}
    <section className="repair-content-section"><h2>症状</h2>
      {filled(symptomText) ? <p className="repair-preserve-lines">{symptomText}</p> : <p className="repair-empty-label">症状は未記録です</p>}
      {symptom.filter(([key]) => key !== 'text').length > 0 && <dl>{symptom.filter(([key]) => key !== 'text').map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{r.symptom[key]}</dd></div>)}</dl>}
    </section>
    {!!checks.length && <section className="repair-content-section"><h2>確認したこと</h2><ol>{checks.map((c, i) => <li key={c.id || i}><strong>{c.part || '部位未記録'}</strong><span className="repair-preserve-lines">{c.finding || '未記録'}</span>{filled(c.basis) && <small>根拠：{c.basis}</small>}</li>)}</ol></section>}
    {!!actions.length && <section className="repair-content-section"><h2>行ったこと</h2><ol>{actions.map((a, i) => <li key={a.id || i}><strong>{a.date || '日付未記録'}</strong><span className="repair-preserve-lines">{a.what || '未記録'}</span><small>{[a.parts && `部品：${a.parts}`, filled(a.cost) && `費用：${a.cost}円`, filled(a.minutes) && `時間：${a.minutes}分`].filter(Boolean).join(' · ')}</small></li>)}</ol></section>}
    {!!outcome.length && <section className="repair-content-section"><h2>結果</h2><dl>{outcome.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="repair-preserve-lines">{value}</dd></div>)}</dl><p className="hint">結果は本人の申告です。原因・修理完了を自動判定した記録ではありません。</p></section>}
  </div>
}

// 修理の内容の入力。開いたときの記録を基準にし、別の操作で変わっていたら保存せず知らせる。
// 空欄のまま保存できる。数値・日付の形式だけ検査する。
export default function RepairEntrySheet({ record, focus = 'symptom', onSave, onClose }) {
  const draft = useRef(null)
  if (!draft.current) draft.current = createRepairEntryDraft(record.meta)
  const [r, setR] = useState(() => {
    const initial = structuredClone(draft.current.initial)
    if (!initial.symptom.text && record.meta.issue) initial.symptom.text = record.meta.issue
    return initial
  })
  const [error, setError] = useState('')
  const problems = repairProblems(r)
  useEffect(() => { document.getElementById(`repair-entry-${focus}`)?.scrollIntoView({ block: 'start' }) }, [focus])
  const set = (group, key, value) => setR(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } }))
  const setRow = (group, id, key, value) => setR(prev => ({ ...prev, [group]: prev[group].map(row => row.id === id ? { ...row, [key]: value } : row) }))
  const removeRow = (group, id) => setR(prev => ({ ...prev, [group]: prev[group].filter(row => row.id !== id) }))
  const save = () => {
    try {
      const meta = draft.current.prepare(record.meta, r)
      if (onSave({ ...record, meta })) onClose()
      else setError('保存できません。入力はこの画面に残っています。')
    } catch (e) { setError(e.message) }
  }
  const input = (group, key, label, type = 'text', rows = 0) => <Field key={key} label={label}>{rows ? <textarea rows={rows} maxLength={4000} value={r[group][key]} onChange={e => set(group, key, e.target.value)} />
    : <input type={type} inputMode={type === 'number' ? 'decimal' : undefined} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} maxLength={type === 'text' ? 200 : undefined} value={r[group][key]} onChange={e => set(group, key, e.target.value)} />}</Field>
  return <Dialog title="修理の内容" className="repair-note-sheet repair-entry" onClose={onClose}>
    <nav className="repair-entry-nav" aria-label="項目">{REPAIR_SECTIONS.map(([key, label]) => <a key={key} href={`#repair-entry-${key}`} onClick={e => { e.preventDefault(); document.getElementById(`repair-entry-${key}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }}>{label}</a>)}</nav>
    <section id="repair-entry-machine" className="repair-entry-section"><h3>機械</h3>
      <div className="fields two">{input('machine', 'maker', 'メーカー')}{input('machine', 'model', '型式')}</div>
      <div className="fields two">{input('machine', 'serial', '号機・年式')}{input('machine', 'hours', '稼働時間（h）', 'number')}</div>
    </section>
    <section id="repair-entry-symptom" className="repair-entry-section"><h3>症状</h3>
      {input('symptom', 'text', '症状（何が、どうなるか）', 'text', 3)}
      <div className="fields two">{input('symptom', 'since', 'いつから')}{input('symptom', 'when', '起きる条件（始動時・負荷時など）', 'text', 2)}</div>
    </section>
    <section id="repair-entry-checks" className="repair-entry-section"><h3>確認したこと</h3>
      <p className="hint">見た部位と、見えたこと・測ったこと。根拠には説明書の頁を。</p>
      {r.checks.map((c, i) => <div className="repair-entry-row" key={c.id}><div className="repair-entry-row-head"><span>確認 {i + 1}</span><button className="quiet" onClick={() => removeRow('checks', c.id)}>削除</button></div>
        {REPAIR_CHECK_FIELDS.map(([key, label]) => <Field key={key} label={label}><textarea rows={key === 'finding' ? 2 : 1} maxLength={key === 'finding' ? 4000 : 200} value={c[key]} onChange={e => setRow('checks', c.id, key, e.target.value)} /></Field>)}</div>)}
      <button className="secondary" onClick={() => setR(prev => ({ ...prev, checks: [...prev.checks, newCheck()] }))}>確認を追加</button>
    </section>
    <section id="repair-entry-actions" className="repair-entry-section"><h3>行ったこと</h3>
      <p className="hint">実際に行った処置だけ。説明書にない手順は書かず、頁を根拠に残す。</p>
      {r.actions.map((a, i) => <div className="repair-entry-row" key={a.id}><div className="repair-entry-row-head"><span>対処 {i + 1}</span><button className="quiet" onClick={() => removeRow('actions', a.id)}>削除</button></div>
        <Field label="日付"><input type="date" value={a.date} onChange={e => setRow('actions', a.id, 'date', e.target.value)} /></Field>
        <Field label="内容"><textarea rows={2} maxLength={4000} value={a.what} onChange={e => setRow('actions', a.id, 'what', e.target.value)} /></Field>
        <Field label="交換部品・品番"><input maxLength={200} value={a.parts} onChange={e => setRow('actions', a.id, 'parts', e.target.value)} /></Field>
        <div className="fields two"><Field label="費用（円）"><input type="number" inputMode="decimal" min="0" step="any" value={a.cost} onChange={e => setRow('actions', a.id, 'cost', e.target.value)} /></Field><Field label="時間（分）"><input type="number" inputMode="decimal" min="0" step="any" value={a.minutes} onChange={e => setRow('actions', a.id, 'minutes', e.target.value)} /></Field></div></div>)}
      <button className="secondary" onClick={() => setR(prev => ({ ...prev, actions: [...prev.actions, newAction()] }))}>対処を追加</button>
    </section>
    <section id="repair-entry-outcome" className="repair-entry-section"><h3>結果</h3>
      <Field label="状態" help="本人の申告として保存します。改善・変化なしは、行ったことを書いてから選べます。"><select value={r.outcome.status} onChange={e => set('outcome', 'status', e.target.value)}><option value="">まだ選ばない</option>{Object.entries(REPAIR_OUTCOMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      {input('outcome', 'note', '確認した内容（何を見て、どう判断したか）', 'text', 3)}
      {input('outcome', 'recheckOn', '次回の確認', 'date')}
    </section>
    {!!problems.length && <ul className="repair-entry-problems" role="alert">{problems.map(text => <li key={text}>{text}</li>)}</ul>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="repair-sheet-footer"><button className="quiet" onClick={onClose}>閉じる</button><span>{hasRepairContent(r) ? '' : '空欄のまま保存できます'}</span><button className="primary" disabled={problems.length > 0} onClick={save}>保存する</button></div>
  </Dialog>
}
