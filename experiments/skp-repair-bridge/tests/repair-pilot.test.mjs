import test from 'node:test'
import assert from 'node:assert/strict'
import { newRepairDraft, isPilotMachine, prepareRepairTransfer, repairDraftText, PILOT_REF, POWER_GUIDE } from '../files/src/repair-pilot.mjs'

const meta = () => ({ subject: 'machine_repair', machineRef: { ...PILOT_REF, partId: 'machine' }, action: '以前の実践', result: '以前の結果', sources: [], inputMode: 'free', stage: '実践中', verdict: '一部達成', observations: [{ id: 'old', fact: '以前の観測' }], conditions: '以前の条件' })
const draft = () => ({ ...newRepairDraft(), observed: 'unknown', action: 'not-performed', reassessment: 'not-assessed' })
const options = { reviewed: true, date: '2026-09-12', expectedRef: { ...PILOT_REF, partId: 'machine' } }

test('exact registered machine and explicit review gate transfer atomically', () => {
  const current = meta(), before = JSON.stringify(current)
  for (const changed of [{ subject: 'normal' }, { machineRef: { ...PILOT_REF, machineId: 'other' } }, { machineRef: { ...PILOT_REF, modelVersion: 'unknown' } }, { machineRef: { ...PILOT_REF, partId: 'unknown' } }]) {
    assert.equal(isPilotMachine({ ...current, ...changed }), false)
    assert.throws(() => prepareRepairTransfer({ ...current, ...changed }, draft(), options))
  }
  assert.throws(() => prepareRepairTransfer(current, draft(), { date: options.date, expectedRef: options.expectedRef }), /確認/)
  assert.throws(() => prepareRepairTransfer({ ...current, machineRef: PILOT_REF }, draft(), options), /対象が変わり/)
  assert.equal(JSON.stringify(current), before)
})

test('explicit observations, performance and reassessment never manufacture completion', () => {
  const current = meta()
  assert.throws(() => prepareRepairTransfer(current, newRepairDraft(), options), /選んで/)
  assert.throws(() => prepareRepairTransfer(current, { ...draft(), action: 'performed' }, options), /行ったこと/)
  assert.throws(() => prepareRepairTransfer(current, { ...draft(), reassessment: 'improved' }, options), /実施した場合/)
  assert.throws(() => prepareRepairTransfer(current, { ...draft(), action: 'performed', actionNote: '記録した対処', reassessment: 'improved' }, options), /再確認/)
  for (const observed of ['yes', 'no', 'unknown']) {
    const result = prepareRepairTransfer(current, { ...draft(), observed }, options)
    assert.match(result.result, /未確認|詰まり/)
    assert.equal(result.stage, current.stage); assert.equal(result.verdict, current.verdict)
  }
  const performed = prepareRepairTransfer(current, { ...draft(), observed: 'yes', action: 'performed', actionNote: '実施した内容を記録', reassessment: 'improved', reassessmentNote: '確認した条件を記録' }, options)
  assert.match(performed.result, /本人が確認/)
  assert.match(performed.result, /自動判定した記録ではありません/)
})

test('append-only visible transfer preserves source history, target, observations and repeated submission', () => {
  const current = meta(), before = JSON.stringify(current), result = prepareRepairTransfer(current, draft(), options)
  assert.ok(result.action.startsWith(current.action + '\n\n')); assert.ok(result.result.startsWith(current.result + '\n\n'))
  assert.equal(result.inputMode, 'sections'); assert.deepEqual(result.machineRef, current.machineRef)
  assert.deepEqual(result.observations, current.observations); assert.equal(result.conditions, current.conditions)
  assert.equal(result.sources.length, 3)
  assert.ok(result.sources.every(source => source.date === '')) // Unknown document dates must not become the observation date.
  assert.deepEqual(result.sources.map(source => source.url.match(/#page=(\d+)/)[1]), ['71', '76', '92'])
  assert.deepEqual(prepareRepairTransfer(result, draft(), options), result)
  assert.deepEqual(prepareRepairTransfer(current, { ...draft(), changeTarget: true }, options).machineRef, PILOT_REF)
  assert.equal(JSON.stringify(current), before)
  assert.equal(POWER_GUIDE.steps.length, 3)
})

test('invalid input, overflow and source ID conflicts reject the whole proposed transfer', () => {
  const current = meta(), before = JSON.stringify(current)
  assert.throws(() => prepareRepairTransfer(current, { ...draft(), actionNote: 'x'.repeat(1001) }, options), /1000/)
  assert.throws(() => prepareRepairTransfer({ ...current, action: 'x'.repeat(20000) }, draft(), options), /20000/)
  assert.throws(() => prepareRepairTransfer({ ...current, sources: [{ id: 'repair-power-manual-53', url: 'https://example.com/other', title: '原出典', date: '' }] }, draft(), options), /重複/)
  assert.throws(() => repairDraftText(draft(), '2026-02-30'), /日付|記録日/)
  assert.equal(JSON.stringify(current), before)
})
