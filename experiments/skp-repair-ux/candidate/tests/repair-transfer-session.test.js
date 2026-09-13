import test from 'node:test'
import assert from 'node:assert/strict'
import { createRepairTransferSession } from '../src/repair-transfer-session.mjs'
import { PILOT_REF, newRepairDraft } from '../src/repair-pilot.mjs'

const initial = () => ({
  subject: 'machine_repair', machineRef: { ...PILOT_REF, partId: 'machine' },
  action: '元からある作業記録', result: '元からある結果', sources: [],
  inputMode: 'free', issue: '出力が弱い', unrelated: { note: '変更しない', flags: [1, 2] }
})
const draft = values => ({ ...newRepairDraft(), observed: 'unknown', action: 'not-performed', reassessment: 'consult', actionNote: '最初の入力案', changeTarget: true, ...values })
const options = { reviewed: true, date: '2026-09-13' }

test('failed save that updates metadata including target can be retried without duplicate text or sources', () => {
  const base = initial(), session = createRepairTransferSession(base)
  const first = session.prepare(base, draft(), options)
  assert.equal(first.machineRef.partId, 'aircleaner')
  const retry = session.prepare(structuredClone(first), draft(), options)
  assert.deepEqual(retry, first)
  assert.equal(retry.sources.length, 3)
  assert.equal(retry.action.split('最初の入力案').length - 1, 1)
  assert.equal(base.action, '元からある作業記録')
  assert.equal(base.machineRef.partId, 'machine')
})

test('editing a failed attempt and cancelling target change replaces only that attempt', () => {
  const base = initial(), session = createRepairTransferSession(base)
  const first = session.prepare(base, draft(), options)
  const revised = session.prepare(first, draft({ observed: 'no', actionNote: '訂正した入力案', changeTarget: false }), options)
  assert.equal(revised.machineRef.partId, base.machineRef.partId)
  assert.match(revised.action, /^元からある作業記録\n\n/)
  assert.match(revised.action, /訂正した入力案/)
  assert.doesNotMatch(revised.action, /最初の入力案/)
  assert.equal(revised.sources.length, 3)
  assert.deepEqual(revised.unrelated, base.unrelated)
  assert.deepEqual(session.initial, base)
})

test('retry also works when failed writes leave either baseline or prior accepted candidate in memory', () => {
  const base = initial(), session = createRepairTransferSession(base)
  session.prepare(base, draft(), options) // No parent update.
  const firstPublished = session.prepare(base, draft({ actionNote: '案二' }), options)
  session.prepare(firstPublished, draft({ actionNote: '案三' }), options) // Throws before parent update.
  const retry = session.prepare(firstPublished, draft({ actionNote: '案四' }), options)
  assert.match(retry.action, /案四/)
  assert.doesNotMatch(retry.action, /案二|案三/)
  assert.equal(retry.sources.length, 3)
})

test('unrelated concurrent edits are rejected rather than overwritten, including nested values', () => {
  const base = initial(), session = createRepairTransferSession(base)
  const first = session.prepare(base, draft(), options)
  for (const edit of [
    value => { value.issue = '別の症状' },
    value => { value.unrelated.flags.reverse() },
    value => { value.sources[0].title = '別の出典名' },
    value => { value.machineRef.partId = 'bonnet' },
    value => { value.extra = true }
  ]) {
    const changed = structuredClone(first)
    edit(changed)
    const before = structuredClone(changed)
    assert.throws(() => session.prepare(changed, draft(), options), /別の場所で変更/)
    assert.deepEqual(changed, before)
  }
  assert.deepEqual(session.prepare(first, draft(), options), first)
})

test('snapshots cannot be rewritten by mutation and ordinary validation still applies', () => {
  const base = initial(), session = createRepairTransferSession(base)
  const first = session.prepare(base, draft(), options)
  first.action = '送信後に別の編集'
  first.unrelated.flags.push(3)
  assert.throws(() => session.prepare(first, draft(), options), /別の場所で変更/)
  assert.throws(() => session.prepare(base, draft(), { ...options, reviewed: false }), /確認してください/)
  assert.throws(() => session.prepare(base, draft({ reassessment: 'improved', reassessmentNote: '見た' }), options), /実施した場合/)
  const reorderedBase = Object.fromEntries(Object.entries(base).reverse())
  assert.match(session.prepare(reorderedBase, draft(), options).action, /最初の入力案/)
})
