import test from 'node:test'
import assert from 'node:assert/strict'
import { createResultDraft } from '../src/repair-result-draft.mjs'
test('failed in-memory append can be retried or revised without recording both drafts', () => {
  const base = { action: '以前の記録', result: '', machineRef: { partId: 'a' }, observations: [] }
  const draft = createResultDraft(base)
  const first = draft.prepare(base, '案A', '未確認')
  assert.deepEqual(draft.prepare(first, '案A', '未確認'), first)
  const revised = draft.prepare(first, '案B', '相談した')
  assert.equal(revised.action, '以前の記録\n\n案B')
  assert.equal(revised.result, '相談した')
  assert.equal(base.action, '以前の記録')
  assert.throws(() => draft.prepare({ ...revised, machineRef: { partId: 'other' } }, '案B', ''), /別の操作/)
})
test('failed persistent save with unchanged memory and input length limits', () => {
  const base = { action: '', result: '' }, draft = createResultDraft(base)
  draft.prepare(base, '旧案', '')
  assert.equal(draft.prepare(base, '訂正', '').action, '訂正')
  assert.throws(() => draft.prepare(base, 'a'.repeat(20001), ''), /長すぎ/)
})
