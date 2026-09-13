import React, { useEffect, useRef, useState } from 'react'
import { Dialog, Field } from './ui.jsx'
import RepairMachineView from './RepairMachineView.jsx'
import { today } from './domain.js'
import { resolveMachineTarget } from './machine-domain.js'
import { POWER_GUIDE, PILOT_REF, OBSERVED, ACTION, REASSESSMENT, newRepairDraft, repairDraftText } from './repair-pilot.mjs'
import { createRepairTransferSession } from './repair-transfer-session.mjs'
import './repair-guide.css'

const OBSERVED_LABELS = { yes: '詰まりが見える', no: '見える範囲では見当たらない', unknown: '確認できない・未確認' }
const RESULT_LABELS = { improved: '改善したと確認', unchanged: '変わらない', 'not-assessed': '再確認していない・判断できない', consult: '作業を進めず相談する' }
const SAFETY = 'ボンネットを扱う前に、エンジン停止から30分以上経過し、やけどのおそれがないことを確認してください。'

function Choices({ label, values, value, onChange, disabledValues = [] }) {
  return <fieldset className="repair-guide-choices"><legend className="sr-only">{label}</legend>{Object.entries(values).map(([id, name]) => <button key={id} type="button" aria-pressed={value === id} disabled={disabledValues.includes(id)} onClick={() => onChange(id)}>{name}</button>)}</fieldset>
}
function Check({ checked, onChange, children }) {
  return <label className="repair-guide-check"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{children}</span></label>
}
function ManualLink({ step }) {
  return <a className="repair-guide-manual" href={step.source} target="_blank" rel="noopener noreferrer">説明書を開く <span>印刷 p.{step.page} ／ PDF {step.page + 18} ページ</span></a>
}

// One decision at a time. A rendered model is optional; repair outcomes are never inferred.
export default function RepairPilot({ meta, onTransfer, onClose }) {
  const [draft, setDraft] = useState(newRepairDraft), [reviewed, setReviewed] = useState(false)
  const [showLocation, setShowLocation] = useState(false), [error, setError] = useState('')
  const [phase, setPhase] = useState('guide'), [guideStep, setGuideStep] = useState(0), [recordStep, setRecordStep] = useState(0)
  const [sheet, setSheet] = useState(null), [checks, setChecks] = useState([false, false, false])
  const [date] = useState(today), submitted = useRef(false), heading = useRef(null)
  const [transferSession] = useState(() => createRepairTransferSession(meta))
  const currentStep = POWER_GUIDE.steps[guideStep], safetyReady = checks.every(Boolean)
  const update = patch => { setDraft(previous => ({ ...previous, ...patch })); setReviewed(false); setError('') }
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [phase, guideStep, recordStep, showLocation])
  let preview = null, incomplete = ''
  try { preview = repairDraftText(draft, date) } catch (problem) { incomplete = problem.message }
  const setCheck = (index, value) => setChecks(previous => previous.map((item, i) => i === index ? value : item))
  function startRecord() { setPhase('record'); setRecordStep(0); setError('') }
  function goBack() {
    setError('')
    if (phase === 'review') setPhase('record')
    else if (phase === 'record' && recordStep > 0) setRecordStep(recordStep - 1)
    else if (phase === 'record') setPhase('guide')
    else if (guideStep > 0) setGuideStep(guideStep - 1)
    else onClose()
  }
  function transfer() {
    if (submitted.current) return
    try {
      if (draft.action === 'performed' && !safetyReady) throw new Error('停止・冷却と、説明書の作業条件を確認してください。')
      const next = transferSession.prepare(meta, draft, { reviewed, date })
      submitted.current = true
      if (!onTransfer(next)) throw new Error('端末への保存を確認できません。記録案を控え、記録画面の保存状態を確認してください。画面内には追記が反映されている場合があります。')
    } catch (problem) { submitted.current = false; setError(problem.message) }
  }
  const recordReady = recordStep === 0 ? Boolean(draft.observed) : recordStep === 1 ? Boolean(draft.action) && (draft.action !== 'performed' || (safetyReady && draft.actionNote.trim())) : Boolean(preview)
  const pageTitle = phase === 'guide' ? currentStep.title : phase === 'review' ? 'この内容を記録しますか？' : ['詰まりは見えますか？', '対処を実施しましたか？', '対処後はどうなりましたか？'][recordStep]
  const sheetTitle = sheet === 'step' ? currentStep.title : sheet === 'safety' ? '実施前の確認' : sheet === 'sources' ? '根拠と対象' : sheet === 'saved-text' ? '保存される文章' : '記録について'

  if (showLocation) return <Dialog title="エアクリーナ" wide className="repair-location-sheet" onClose={() => setShowLocation(false)}><RepairMachineView machineRef={PILOT_REF} /><button type="button" className="primary" onClick={() => setShowLocation(false)}>案内に戻る</button></Dialog>
  return <>
    <Dialog title="症状から確認する" wide className="repair-pilot repair-guide" onClose={onClose}>
      <div className="repair-guide-content">
        <p className="repair-guide-machine">SKP-101W · エアクリーナ</p>
        <h3 className="repair-guide-symptom">{POWER_GUIDE.label}</h3>
        <nav className="repair-guide-progress" aria-label="確認の進み具合">{['案内', '記録', '確認'].map((name, index) => <span key={name} aria-current={index === ['guide', 'record', 'review'].indexOf(phase) ? 'step' : undefined}>{index + 1} {name}</span>)}</nav>
        <div className="repair-guide-page" data-repair-phase={phase} data-repair-step={phase === 'guide' ? guideStep : recordStep}>
          <p className="repair-guide-count">{phase === 'guide' ? `${guideStep + 1} / ${POWER_GUIDE.steps.length}` : phase === 'record' ? `${recordStep + 1} / 3` : date}</p>
          <h3 ref={heading} tabIndex={-1} className="repair-guide-question">{pageTitle}</h3>
          {phase === 'guide' && <>
            <div className="repair-guide-tools">
              <button type="button" onClick={() => setShowLocation(true)}>3Dで位置を見る</button>
              <button type="button" onClick={() => setSheet('step')}>操作・説明書</button>
              <button type="button" onClick={() => setSheet('sources')}>根拠</button>
            </div>
            {checks[guideStep] && <p className="repair-guide-checked" role="status">この手順の条件を確認済み</p>}
          </>}
          {phase === 'record' && recordStep === 0 && <>
            <Choices label="目視での確認結果" values={OBSERVED_LABELS} value={draft.observed} onChange={observed => update({ observed })} />
            <div className="repair-guide-tools"><button type="button" onClick={() => setShowLocation(true)}>3Dで位置を見る</button><button type="button" onClick={() => setSheet('sources')}>根拠</button></div>
          </>}
          {phase === 'record' && recordStep === 1 && <>
            <Choices label="対処の実施状況" values={ACTION} value={draft.action} disabledValues={safetyReady ? [] : ['performed']} onChange={action => update({ action, reassessment: '', reassessmentNote: '' })} />
            {!safetyReady && <button type="button" className="repair-guide-inline" onClick={() => setSheet('safety')}>実施した場合は、停止・冷却と原典の条件を確認</button>}
            {draft.action && <Field label={draft.action === 'performed' ? '行ったこと（必須）' : '実施しなかった理由（任意）'}><textarea rows={3} maxLength={1000} value={draft.actionNote} onChange={event => update({ actionNote: event.target.value })} /></Field>}
          </>}
          {phase === 'record' && recordStep === 2 && <>
            <Choices label="対処後の状態" values={draft.action === 'performed' ? RESULT_LABELS : { 'not-assessed': RESULT_LABELS['not-assessed'], consult: RESULT_LABELS.consult }} value={draft.reassessment} onChange={reassessment => update({ reassessment })} />
            {draft.reassessment && <Field label={['improved', 'unchanged'].includes(draft.reassessment) ? '何を見て再確認しましたか？（必須）' : '未確認の点・相談内容（任意）'}><textarea rows={3} maxLength={1000} value={draft.reassessmentNote} onChange={event => update({ reassessmentNote: event.target.value })} /></Field>}
          </>}
          {phase === 'review' && <>
            <dl className="repair-guide-review">
              <div><dt>目視</dt><dd>{OBSERVED[draft.observed]}</dd></div>
              <div><dt>対処</dt><dd>{ACTION[draft.action]}{draft.actionNote.trim() && <p>{draft.actionNote.trim()}</p>}</dd></div>
              <div><dt>結果</dt><dd>{REASSESSMENT[draft.reassessment]}{draft.reassessmentNote.trim() && <p>{draft.reassessmentNote.trim()}</p>}</dd></div>
              <div><dt>対象</dt><dd>{draft.changeTarget ? 'SKP-101W · エアクリーナ' : resolveMachineTarget(transferSession.initial).label || '未確認'}</dd></div>
            </dl>
            <Check checked={draft.changeTarget} onChange={changeTarget => update({ changeTarget })}>対象部品をエアクリーナに変更</Check>
            <p className="repair-guide-caption">本人の記録です。原因・修理完了は自動判定しません。</p>
            <div className="repair-guide-tools"><button type="button" onClick={() => setSheet('saved-text')}>保存される文章</button><button type="button" onClick={() => setSheet('record-info')}>保存について</button><button type="button" onClick={() => setSheet('sources')}>出典 3 件</button></div>
            <Check checked={reviewed} onChange={setReviewed}>内容と対象を確認し、今の記録へ追記する</Check>
          </>}
          {error && <p className="notice error" role="alert">{error}</p>}
        </div>
      </div>
      <footer className="repair-guide-footer">
        <div className="repair-guide-footer-row">
          <button type="button" className="repair-guide-back" onClick={goBack}>{phase === 'guide' && guideStep === 0 ? '閉じる' : '前へ'}</button>
          {phase === 'guide' ? <button type="button" className="primary" onClick={() => {
            if (!checks[guideStep]) setSheet('step')
            else if (guideStep < POWER_GUIDE.steps.length - 1) setGuideStep(guideStep + 1)
            else startRecord()
          }}>{!checks[guideStep] ? '条件と操作を確認' : guideStep === POWER_GUIDE.steps.length - 1 ? '確認結果を記録' : '次へ'}</button> : phase === 'record' ? <button type="button" className="primary" disabled={!recordReady} onClick={() => recordStep < 2 ? setRecordStep(recordStep + 1) : setPhase('review')}>{recordStep < 2 ? '次へ' : '記録案を確認'}</button> : <button type="button" className="primary" disabled={!preview || !reviewed || (draft.action === 'performed' && !safetyReady)} onClick={transfer}>記録へ追記</button>}
        </div>
        {phase === 'guide' && <button type="button" className="repair-guide-skip" onClick={startRecord}>作業せず、未確認・相談を記録</button>}
      </footer>
    </Dialog>
    {sheet && <Dialog title={sheetTitle} className="repair-guide-sheet" onClose={() => setSheet(null)}>
      {sheet === 'step' && <>
        <div className="repair-guide-instruction"><p>{currentStep.text}</p>{guideStep === 1 && <p>{SAFETY}</p>}{guideStep === 2 && <p>清掃・取り外しは下の説明書で方法と条件を確認します。確認できない場合は作業を進めません。</p>}</div>
        <ManualLink step={currentStep} />
        <Check checked={checks[guideStep]} onChange={value => setCheck(guideStep, value)}>{guideStep === 0 ? '停止条件と説明書を確認した' : guideStep === 1 ? '停止後30分以上・熱の確認と、説明書の条件を満たした' : '説明書で方法と作業条件を確認した'}</Check>
        <button type="button" className="primary repair-guide-sheet-primary" onClick={() => setSheet(null)}>{checks[guideStep] ? '案内に戻る' : '未確認のまま戻る'}</button>
      </>}
      {sheet === 'safety' && <>
        {POWER_GUIDE.steps.map((step, index) => <section key={step.page} className="repair-guide-safety-item"><h3>{step.title}</h3><p>{step.text}</p>{index === 1 && <p>{SAFETY}</p>}<ManualLink step={step} /><Check checked={checks[index]} onChange={value => setCheck(index, value)}>{index === 0 ? '停止条件を確認した' : index === 1 ? '停止後30分以上・熱の確認と、原典の条件を満たした' : '原典で方法と作業条件を確認した'}</Check></section>)}
        <button type="button" className="primary repair-guide-sheet-primary" onClick={() => setSheet(null)}>記録に戻る</button>
      </>}
      {sheet === 'sources' && <><p>エアクリーナは点検候補の一つです。ここでは原因を確定しません。</p><p>対象は SKP-101W。この案内を他型式の作業条件として使用しないでください。</p>{POWER_GUIDE.steps.map(step => <ManualLink key={step.page} step={step} />)}<p className="repair-guide-caption">説明書の印刷 p.53・58・74 を出典に保持します。</p></>}
      {sheet === 'saved-text' && (preview ? <><h3>実践したこと</h3><pre className="repair-guide-saved-text">{preview.action}</pre><h3>結果</h3><pre className="repair-guide-saved-text">{preview.result}</pre></> : <p role="status">{incomplete}</p>)}
      {sheet === 'record-info' && <><p>既存の実践・結果へ追記し、同じ記録と出典は重複させません。進捗や「完了」の判定は変えません。</p><p>修理詳細へ戻ります。以前のメモも「その他」から確認できます。</p><p>実際の保存状態は、記録画面の保存表示で確認してください。保存できない場合はこの入力案を保持します。</p></>}
    </Dialog>}
  </>
}
