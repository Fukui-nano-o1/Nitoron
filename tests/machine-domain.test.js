import test from 'node:test'
import assert from 'node:assert/strict'
import { newRecord, toRow, fromRow, publicSnapshot, publicationKey, publishedDiffers, sanitizeMeta, sanitizeMachineRef, isBlankRecord } from '../src/domain.js'
import { MACHINE_SUBJECT, MODEL_VERSION, ROOT_PART_ID, resolveMachineRef, resolveMachineTarget } from '../src/machine-domain.js'

const ref = partId => ({ machineId: 'skp-101w', partId, modelVersion: MODEL_VERSION })
const repairRecord = partId => {
  const r = newRecord('trouble', '発表者')
  r.title = '修理記録'
  r.meta.subject = MACHINE_SUBJECT
  r.meta.machineRef = ref(partId)
  return r
}

test('実IDが保存→再読込→公開スナップショット→提供resolverまで一致する', () => {
  // 全体・外装・内部・深い階層。全体は保存するpartIdが'machine'で、resolverの状態名がwhole。
  const cases = [[ROOT_PART_ID, 'whole', 'SKP-101W'], ['bonnet', 'resolved', 'ボンネット'],
    ['aircleaner__element', 'resolved', 'エアクリーナエレメント'], ['frontL__fasteners__a0__bolt', 'resolved', 'ボルト（形状・本数未確認）']]
  assert.equal(ROOT_PART_ID, 'machine')
  for (const [partId, status, name] of cases) {
    const r = repairRecord(partId)
    const restored = fromRow(toRow(r, 'owner'))
    assert.deepEqual(restored.meta.machineRef, ref(partId))
    assert.equal(restored.meta.subject, MACHINE_SUBJECT)
    const published = fromRow(publicSnapshot(restored))
    assert.deepEqual(published.meta.machineRef, ref(partId))
    const resolution = resolveMachineRef(published.meta.machineRef)
    assert.equal(resolution.status, status)
    assert.equal(resolution.node.name, name)
    assert.equal(publicationKey(r), publicationKey(restored))
  }
})

test('対象部品の変更は公開差分として検出される', () => {
  const r = repairRecord('bonnet')
  const publishedSnapshot = publicSnapshot(r)
  assert.equal(publishedDiffers(r, publishedSnapshot), false)
  r.meta.machineRef = ref('aircleaner__element')
  assert.equal(publishedDiffers(r, publishedSnapshot), true)
})

test('未知のID・版・機種は値を書き換えずに保持し、状態だけで区別する', () => {
  // 正常な文字列形式なら、現在のカタログにないIDも読み込み時に消さない・変換しない
  const unknowns = [
    [{ machineId: 'skp-101w', partId: 'no-such-part', modelVersion: MODEL_VERSION }, 'unknown-part'],
    [{ machineId: 'skp-101w', partId: 'bonnet', modelVersion: 'skp-101w@0000000' }, 'unknown-version'],
    [{ machineId: 'other-machine', partId: 'bonnet', modelVersion: MODEL_VERSION }, 'unknown-machine'],
  ]
  for (const [raw, status] of unknowns) {
    const kept = sanitizeMachineRef(raw)
    assert.deepEqual(kept, raw)
    const target = resolveMachineTarget({ subject: MACHINE_SUBJECT, machineRef: kept })
    assert.equal(target.status, status)
    assert.match(target.label, /対象部品を確認できません/)
  }
  assert.equal(resolveMachineTarget({ subject: MACHINE_SUBJECT, machineRef: ref('') }).status, 'unselected')
  assert.equal(resolveMachineTarget({ subject: MACHINE_SUBJECT, machineRef: null }).status, 'unselected')
})

test('旧形式・不正な参照は通常記録として安全に読める', () => {
  const legacy = sanitizeMeta({ kind: 'presentation', summary: '分野⑦以前の記録' })
  assert.equal(legacy.subject, 'normal'); assert.equal(legacy.machineRef, null)
  const odd = sanitizeMeta({ subject: 'spaceship', machineRef: { partId: 'x' } })
  assert.equal(odd.subject, 'normal'); assert.equal(odd.machineRef, null)
  for (const bad of [null, 'skp-101w', ['skp-101w'], { machineId: '' }, { machineId: 42 }]) assert.equal(sanitizeMachineRef(bad), null)
  // 欠落した partId・modelVersion は空文字のまま。機種・版・全体IDを補完しない
  assert.deepEqual(sanitizeMachineRef({ machineId: 'skp-101w' }), { machineId: 'skp-101w', partId: '', modelVersion: '' })
})

test('通常への切替で機械参照を消さず、入力モードの判定にも影響しない', () => {
  const r = repairRecord('bonnet')
  r.meta.subject = 'normal'
  const restored = fromRow(toRow(r))
  assert.deepEqual(restored.meta.machineRef, ref('bonnet'))
  assert.equal(restored.meta.subject, 'normal')
  assert.equal(restored.meta.inputMode, 'free')
  assert.equal(resolveMachineTarget(restored.meta).status, 'none')
})

test('機械修理の選択だけでも空の記録として捨てられない', () => {
  const r = newRecord('trouble')
  assert.equal(isBlankRecord(r), true)
  r.meta.subject = MACHINE_SUBJECT
  assert.equal(isBlankRecord(r), false)
  const withRef = newRecord('trouble')
  withRef.meta.machineRef = ref('')
  assert.equal(isBlankRecord(withRef), false)
})

test('対象表示はズームを見なくても対象が分かる', () => {
  assert.equal(resolveMachineTarget({ subject: 'normal' }).label, '')
  assert.equal(resolveMachineTarget({ subject: MACHINE_SUBJECT, machineRef: ref(ROOT_PART_ID) }).label, 'SKP-101W · 機械全体')
  assert.equal(resolveMachineTarget({ subject: MACHINE_SUBJECT, machineRef: ref('bonnet') }).label, 'SKP-101W · ボンネット')
  assert.equal(resolveMachineTarget({ subject: MACHINE_SUBJECT, machineRef: null }).label, '機種・部品未選択')
  assert.equal(resolveMachineTarget({ subject: MACHINE_SUBJECT, machineRef: ref('') }).label, 'SKP-101W · 部品未選択')
})
