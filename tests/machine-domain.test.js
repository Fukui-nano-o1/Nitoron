import test from 'node:test'
import assert from 'node:assert/strict'
import { newRecord, toRow, fromRow, snapshot, publicSnapshot, publicationKey, publishedDiffers, sanitizeMeta, sanitizeMachineRef, isBlankRecord } from '../src/domain.js'
import { MACHINE_SUBJECT, WHOLE_MACHINE, resolveMachineRef, machineTargetLabel } from '../src/machine-domain.js'

const repairRecord = (partId = 'engine-carburetor') => {
  const r = newRecord('trouble', '発表者')
  r.title = 'キャブレターの詰まり'
  r.meta.subject = MACHINE_SUBJECT
  r.meta.machineRef = { machineId: 'skp-101w', partId, modelVersion: 'v4' }
  return r
}

test('機械参照は保存→再読込→公開スナップショットの往復で一致する', () => {
  const r = repairRecord()
  const restored = fromRow(toRow(r, 'owner'))
  assert.equal(restored.meta.subject, MACHINE_SUBJECT)
  assert.deepEqual(restored.meta.machineRef, { machineId: 'skp-101w', partId: 'engine-carburetor', modelVersion: 'v4' })
  const published = fromRow(publicSnapshot(r))
  assert.deepEqual(published.meta.machineRef, r.meta.machineRef)
  assert.equal(publicationKey(r), publicationKey(restored))
})

test('対象部品の変更は「公開版と異なる変更」として検出される', () => {
  const r = repairRecord()
  const publishedSnapshot = publicSnapshot(r)
  assert.equal(publishedDiffers(r, publishedSnapshot), false)
  r.meta.machineRef = { ...r.meta.machineRef, partId: 'wheel-left' }
  assert.equal(publishedDiffers(r, publishedSnapshot), true)
})

test('旧形式・不正な機械参照は通常記録として安全に読める', () => {
  // 分野⑦以前の記録：キーなし → 既定値
  const legacy = sanitizeMeta({ kind: 'presentation', summary: '旧記録' })
  assert.equal(legacy.subject, ''); assert.equal(legacy.machineRef, null)
  // 未知の subject は通常扱い。machineId のない参照は保存しない
  const odd = sanitizeMeta({ subject: 'spaceship', machineRef: { partId: 'x' } })
  assert.equal(odd.subject, ''); assert.equal(odd.machineRef, null)
  for (const bad of [null, 'skp-101w', ['skp-101w'], { machineId: '' }, { machineId: 42 }]) assert.equal(sanitizeMachineRef(bad), null)
  // partId・modelVersion の欠落は空文字（未選択）へ丸める
  assert.deepEqual(sanitizeMachineRef({ machineId: 'skp-101w' }), { machineId: 'skp-101w', partId: '', modelVersion: '' })
})

test('通常への切替で機械参照を消さず、入力モードの判定にも影響しない', () => {
  const r = repairRecord()
  r.meta.subject = '' // 通常へ切替
  const restored = fromRow(toRow(r))
  assert.deepEqual(restored.meta.machineRef, { machineId: 'skp-101w', partId: 'engine-carburetor', modelVersion: 'v4' })
  assert.equal(restored.meta.subject, '')
  // 機械参照だけの記録がフリー入力から項目モードへ勝手に切り替わらない
  assert.equal(restored.meta.inputMode, 'free')
})

test('機械修理の選択だけでも空の記録として捨てられない', () => {
  const r = newRecord('trouble')
  assert.equal(isBlankRecord(r), true)
  r.meta.subject = MACHINE_SUBJECT
  assert.equal(isBlankRecord(r), false)
  const withRef = newRecord('trouble')
  withRef.meta.machineRef = { machineId: 'skp-101w', partId: '', modelVersion: '' }
  assert.equal(isBlankRecord(withRef), false)
})

test('全体指定・部品未指定・不明ID・未知のモデル版を区別する', () => {
  const meta = partial => ({ subject: MACHINE_SUBJECT, machineRef: { machineId: 'skp-101w', partId: '', modelVersion: '', ...partial } })
  assert.equal(resolveMachineRef({ subject: '' }).status, 'none')
  assert.equal(resolveMachineRef({ subject: MACHINE_SUBJECT, machineRef: null }).status, 'unselected')
  assert.equal(resolveMachineRef(meta({})).status, 'unselected')
  assert.equal(resolveMachineRef(meta({ partId: WHOLE_MACHINE })).status, 'whole')
  assert.equal(resolveMachineRef({ subject: MACHINE_SUBJECT, machineRef: { machineId: 'unknown-tractor', partId: 'p1', modelVersion: 'v1' } }).status, 'unknown-machine')
  // 部品カタログ未登録の間、具体的な部品IDは未知のモデル版として扱う（推測で部品に割り当てない）
  assert.equal(resolveMachineRef(meta({ partId: 'engine-carburetor', modelVersion: 'v4' })).status, 'unknown-version')
})

test('対象表示はズームを見なくても対象が分かる', () => {
  assert.equal(machineTargetLabel(resolveMachineRef({ subject: '' })), '')
  assert.equal(machineTargetLabel(resolveMachineRef({ subject: MACHINE_SUBJECT, machineRef: { machineId: 'skp-101w', partId: WHOLE_MACHINE, modelVersion: '' } })), 'クボタ SKP-101W · 機械全体')
  assert.equal(machineTargetLabel(resolveMachineRef({ subject: MACHINE_SUBJECT, machineRef: null })), '機種・部品未選択')
  assert.match(machineTargetLabel(resolveMachineRef({ subject: MACHINE_SUBJECT, machineRef: { machineId: 'skp-101w', partId: 'p', modelVersion: 'v9' } })), /対象部品を確認できません/)
})
