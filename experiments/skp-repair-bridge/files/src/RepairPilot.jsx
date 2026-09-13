import React, { useRef, useState } from 'react'
import { Dialog, Field } from './ui.jsx'
import MachinePicker from './MachinePicker.jsx'
import { today } from './domain.js'
import { resolveMachineTarget } from './machine-domain.js'
import { POWER_GUIDE, PILOT_REF, OBSERVED, ACTION, REASSESSMENT, newRepairDraft, repairDraftText, prepareRepairTransfer } from './repair-pilot.mjs'

function Choices({ label, values, value, onChange }) {
  return <Field label={label}><select value={value} onChange={event => onChange(event.target.value)}><option value="">選んでください</option>{Object.entries(values).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field>
}

// A record-connected pilot. Reading and recording do not depend on a WebGL renderer.
export default function RepairPilot({ meta, onTransfer, onClose }) {
  const [draft, setDraft] = useState(newRepairDraft), [reviewed, setReviewed] = useState(false)
  const [showLocation, setShowLocation] = useState(false), [error, setError] = useState('')
  const [date] = useState(today), submitted = useRef(false)
  const [expectedRef] = useState(() => ({ ...meta.machineRef }))
  const update = patch => { setDraft(previous => ({ ...previous, ...patch })); setReviewed(false); setError('') }
  let preview = null, incomplete = ''
  try { preview = repairDraftText(draft, date) } catch (problem) { incomplete = problem.message }
  function transfer() {
    if (submitted.current) return
    try {
      const next = prepareRepairTransfer(meta, draft, { reviewed, date, expectedRef })
      submitted.current = true
      if (!onTransfer(next)) throw new Error('端末への保存を確認できません。記録案を控え、記録画面の保存状態を確認してください。画面内には追記が反映されている場合があります。')
    } catch (problem) { submitted.current = false; setError(problem.message) }
  }
  if (showLocation) return <MachinePicker value={PILOT_REF} readOnly onClose={() => setShowLocation(false)} />
  return <Dialog title="症状から確認する" wide className="repair-pilot" onClose={onClose}>
    <h3>{POWER_GUIDE.label}</h3>
    <p>対象：SKP-101W。エアクリーナは点検候補の一つです。ここでは原因を確定しません。</p>
    <ol className="repair-pilot-steps">{POWER_GUIDE.steps.map((step, index) => <li key={step.title}>
      <h4>{step.title}</h4><p>{step.text}</p>
      {index === 1 && <p>ボンネットを扱うときは、エンジン停止から30分以上経過し、やけどのおそれがないことを確認してください。扱い方は下の説明書を確認します。</p>}
      <a href={step.source} target="_blank" rel="noopener noreferrer">説明書：印刷p.{step.page}（PDF {step.page + 18}ページ）を開く</a>
    </li>)}</ol>
    <p>清掃や取り外しの具体的な方法は説明書を参照してください。確認できない場合は作業を進めず、「確認できない・未確認」を選べます。</p>
    <button type="button" className="secondary" onClick={() => setShowLocation(true)}>エアクリーナの位置を3Dで見る</button>
    <h3>実際に確認したことを記録</h3>
    <Choices label="ほこりやごみの詰まりが見える？" values={OBSERVED} value={draft.observed} onChange={observed => update({ observed })} />
    <Choices label="対処を実施した？" values={ACTION} value={draft.action} onChange={action => update({ action, reassessment: '', reassessmentNote: '' })} />
    <Field label={draft.action === 'performed' ? '実際に行ったこと（必須）' : '実施しなかった理由など（任意）'}><textarea rows={3} maxLength={1000} value={draft.actionNote} onChange={event => update({ actionNote: event.target.value })} placeholder="自分が実際に行ったことを書いてください。" /></Field>
    <Choices label="対処後の状態" values={draft.action === 'performed' ? REASSESSMENT : { 'not-assessed': REASSESSMENT['not-assessed'], consult: REASSESSMENT.consult }} value={draft.reassessment} onChange={reassessment => update({ reassessment })} />
    <Field label={['improved', 'unchanged'].includes(draft.reassessment) ? '何を見て、どう再確認した？（必須）' : '再確認できない点・相談したいこと（任意）'}><textarea rows={3} maxLength={1000} value={draft.reassessmentNote} onChange={event => update({ reassessmentNote: event.target.value })} /></Field>
    <h3>記録へ追記する内容</h3>
    <p>現在の記録対象：{resolveMachineTarget(meta).label || '未確認'}</p>
    {preview ? <><h4>実践したこと</h4><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit' }}>{preview.action}</pre><h4>結果</h4><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit' }}>{preview.result}</pre></> : <p role="status">{incomplete}</p>}
    <p>説明書の印刷p.53・58・74を「出典・資料」に追加します。既に同じページがあれば重複させません。</p>
    <label className="field"><span><input type="checkbox" checked={draft.changeTarget} onChange={event => update({ changeTarget: event.target.checked })} /> 記録の対象部品を「エアクリーナ」に変更する</span><small>チェックしない場合、現在の対象部品を保持します。</small></label>
    <p>追記すると「内容・資料」の「項目で分ける」表示へ移ります。既存の実践・結果に追記し、これまでの自由本文は補足として残します。「完了」や本人の判定は変更しません。</p>
    <label className="field"><span><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> 上の記録案と対象部品を確認した。既存の項目へ追記する</span></label>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="actions"><button type="button" className="secondary" onClick={onClose}>閉じる</button><button type="button" className="primary" disabled={!preview || !reviewed} onClick={transfer}>内容・資料の項目欄へ追記</button></div>
    <p className="hint">実際の保存状態は、記録画面上部の保存表示で確認してください。</p>
  </Dialog>
}
