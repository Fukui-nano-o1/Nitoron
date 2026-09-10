import test from 'node:test'
import assert from 'node:assert/strict'
import { metricCell, per10aCell, balanceCell, canConvert, conditionText } from '../src/compare-domain.js'
test('比較の数字：単位を併記し、未入力は未記載、0は0、単位違いの記載は換算しない', () => {
  assert.deepEqual(metricCell('', 'kg'), { kind: 'blank', text: '未記載' })
  assert.deepEqual(metricCell(undefined, 'kg'), { kind: 'blank', text: '未記載' })
  assert.equal(metricCell('0', 'kg').text, '0 kg')
  assert.equal(metricCell('1250.5', '円').text, '1,250.5 円')
  assert.equal(metricCell('30箱', 'kg').kind, 'text'); assert.ok(metricCell('30箱', 'kg').text.startsWith('30箱'))
})
test('10a換算は面積が数値で正のときだけ、収支差額は売上・経費が両方あるときだけ', () => {
  assert.equal(per10aCell('500', '5', 'kg').text, '1,000 kg')
  assert.equal(per10aCell('500', '', 'kg').kind, 'blank'); assert.ok(per10aCell('500', '', 'kg').text.includes('面積未記載'))
  assert.equal(per10aCell('30箱', '5', 'kg').kind, 'blank')
  assert.equal(per10aCell('', '5', 'kg').text, '未記載')
  assert.equal(balanceCell('100000', '40000', '', 'total').text, '60,000 円')
  assert.equal(balanceCell('100000', '', '', 'total').kind, 'blank')
  assert.equal(balanceCell('100000', '40000', '', '10a').kind, 'blank')
  assert.equal(balanceCell('100000', '40000', '4', '10a').text, '150,000 円')
  assert.equal(canConvert([{ areaA: '', revenue: '1' }]), false); assert.equal(canConvert([{ areaA: '3', hours: '0' }]), true)
  assert.equal(conditionText({ areaA: '10', start: '2026-04-01', end: '' }), '面積 10 a · 期間 2026-04-01〜？')
  assert.equal(conditionText({}), '面積 未記載 · 期間 未記載')
})
