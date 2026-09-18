import test from 'node:test'
import assert from 'node:assert/strict'
import { newRecord } from '../src/domain.js'
import { listingStepKey, resolveListingStep, listingStepProblem } from '../src/listing-flow.js'

test('a saved listing position is account/record scoped, while an explicit URL wins', () => {
  assert.notEqual(listingStepKey('one', 'a'), listingStepKey('two', 'a'))
  assert.notEqual(listingStepKey('one', 'a'), listingStepKey('one', 'b'))
  assert.equal(resolveListingStep(undefined, 'photos'), 'photos')
  assert.equal(resolveListingStep('title', 'photos'), 'title')
  assert.equal(resolveListingStep('invalid', 'photos'), 'photos')
  assert.equal(resolveListingStep('done', 'done'), 'intro') // Success requires a completed write, never a URL.
})
test('optional information and photos never prevent moving on', () => {
  const record = newRecord()
  assert.equal(listingStepProblem(record, 'details'), '')
  assert.equal(listingStepProblem(record, 'photos'), '')
  assert.match(listingStepProblem(record, 'title'), /タイトル/)
  record.title = '  '
  assert.match(listingStepProblem(record, 'title'), /タイトル/)
  record.title = '実践の記録'
  assert.equal(listingStepProblem(record, 'title'), '')
})
test('invalid periods, area and external photo schemes are caught before review', () => {
  const record = newRecord()
  record.meta.start = '2026-09-18'; record.meta.end = '2026-09-01'
  assert.match(listingStepProblem(record, 'details'), /終了日/)
  record.meta.end = '2026-09-18'; record.meta.areaA = '-1'
  assert.match(listingStepProblem(record, 'details'), /面積/)
  record.meta.areaA = '10'
  assert.equal(listingStepProblem(record, 'details'), '')
  record.meta.coverUrl = 'javascript:alert(1)'
  assert.match(listingStepProblem(record, 'photos'), /URL/)
  record.meta.coverUrl = 'https://example.com/photo.jpg'
  assert.equal(listingStepProblem(record, 'photos'), '')
})
