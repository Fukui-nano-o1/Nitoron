import test from 'node:test'
import assert from 'node:assert/strict'
import { newRecord, fromRow, toRow } from '../src/domain.js'
import { REPAIR_MACHINES, isRepairRecord, createRepairRegistry, newRepairRecord, newFreeRepairRecord, repairLookup, searchRepairMachines } from '../src/repair-workspace.mjs'

// Contract fixtures only. Neither manufacturer/model is a real supported product.
function fixture(machineId, maker, model, rootPartId, partId) {
  const modelVersion = `${machineId}@fixture-1`
  const parts = new Map([[rootPartId, { id: rootPartId, name: model }], [partId, { id: partId, name: `${maker}の部品` }]])
  return { machineId, maker, model, name: `${maker} ${model}`, modelVersion, rootPartId, aliases: [],
    resolveRef: ref => {
      assert.equal(ref.machineId, machineId)
      assert.equal(ref.modelVersion, modelVersion)
      const node = parts.get(ref.partId)
      return node ? { status: ref.partId === rootPartId ? 'whole' : 'resolved', node } : { status: 'unknown-part', node: null }
    } }
}
const a = fixture('fixture-alpha', '架空メーカー甲', 'AX-01', 'root-a', 'pump-a')
const b = fixture('fixture-beta', '架空メーカー乙', 'BX-02', 'root-b', 'filter-b')
const partRef = descriptor => ({ machineId: descriptor.machineId, modelVersion: descriptor.modelVersion, partId: descriptor.rootPartId })

test('異なる架空メーカーの機械・部品を同じUI契約で解決し実登録はSKP一件に限る', () => {
  const registry = createRepairRegistry([a, b])
  for (const [descriptor, partId] of [[a, 'pump-a'], [b, 'filter-b']]) {
    const result = repairLookup({ ...partRef(descriptor), partId }, registry)
    assert.equal(result.status, 'resolved')
    assert.equal(result.descriptor.machineId, descriptor.machineId)
    assert.equal(result.machineLabel, descriptor.name)
    assert.equal(result.partLabel, `${descriptor.maker}の部品`)
  }
  assert.equal(REPAIR_MACHINES.length, 1)
  assert.equal(REPAIR_MACHINES[0].machineId, 'skp-101w')
  assert.equal(REPAIR_MACHINES[0].guideKey, 'skp-power')
  assert.equal(repairLookup(partRef(REPAIR_MACHINES[0])).status, 'whole')
  assert.throws(() => createRepairRegistry([a, a]), /重複/)
})

test('未知機種・未知版を既知機種へ代用せず未知部品は元参照を保持する', () => {
  const registry = createRepairRegistry([a, b])
  for (const [ref, status] of [
    [{ ...partRef(a), machineId: 'unregistered' }, 'unknown-machine'],
    [{ ...partRef(a), modelVersion: 'newer' }, 'unknown-version'],
  ]) {
    const original = structuredClone(ref)
    const result = repairLookup(ref, registry)
    assert.equal(result.status, status)
    assert.equal(result.descriptor, null)
    assert.equal(result.node, null)
    assert.deepEqual(result.ref, original)
    assert.deepEqual(ref, original)
  }
  const unknownPart = { ...partRef(a), partId: 'filter-b' }
  const result = repairLookup(unknownPart, registry)
  assert.equal(result.status, 'unknown-part')
  assert.equal(result.descriptor.machineId, a.machineId)
  assert.equal(result.node, null)
  assert.deepEqual(result.ref, unknownPart)
  assert.equal(repairLookup({ ...partRef(a), partId: '' }, registry).status, 'unselected')
  assert.equal(repairLookup({ ...partRef(a), partId: 3 }, registry).status, 'invalid')
  const wrongResolver = { ...a, resolveRef: () => ({ status: 'whole', node: { id: a.rootPartId, name: a.model } }) }
  assert.equal(repairLookup(unknownPart, createRepairRegistry([wrongResolver])).status, 'invalid')
})

test('新規修理は発表内容なしで始まり各機種の対象・結果・未知部品が既存保存層で往復する', () => {
  const registry = createRepairRegistry([a, b])
  for (const descriptor of [a, b]) {
    const record = newRepairRecord(descriptor)
    assert.equal(record.title, descriptor.name)
    assert.equal(record.meta.kind, 'trouble')
    assert.equal(isRepairRecord(record), true)
    assert.deepEqual(record.meta.machineRef, partRef(descriptor))
    for (const key of ['author', 'crop', 'issue', 'action', 'result', 'hypothesis', 'interpretation', 'summary']) assert.equal(record.meta[key], '')
    record.meta.machineRef.partId = 'retired-part'
    record.meta.issue = '異音がする'
    record.meta.action = '観測内容を記録した'
    record.meta.result = '改善は確認していない'
    const restored = fromRow(toRow(record, 'owner'))
    assert.deepEqual(restored, record)
    assert.equal(repairLookup(restored.meta.machineRef, registry).status, 'unknown-part')
  }
  assert.throws(() => newRepairRecord(undefined), /登録情報/)
})

test('メーカー・型番の全語検索はUnicode表記差を吸収し未登録メーカーへ代用しない', () => {
  assert.deepEqual(searchRepairMachines('Ｋｕｂｏｔａ　ＳＫＰ－１０１Ｗ'), REPAIR_MACHINES)
  assert.deepEqual(searchRepairMachines('くぼた skp–101w'), REPAIR_MACHINES)
  assert.deepEqual(searchRepairMachines('ヤンマー SKP-101W'), [])
  assert.deepEqual(searchRepairMachines('架空メーカー乙　ＢＸ－０２', [a, b]), [b])
  assert.deepEqual(searchRepairMachines('架空メーカー甲 BX-02', [a, b]), [])
})

test('既存の発表・通常トラブルは修理へ読み替えず既存保存形式を変更しない', () => {
  for (const kind of ['presentation', 'trouble', 'memo']) {
    const record = newRecord(kind, '既存の著者')
    record.title = '既存記録'
    if (record.meta) record.meta.machineRef = partRef(REPAIR_MACHINES[0])
    const original = structuredClone(record)
    assert.equal(isRepairRecord(record), false)
    assert.deepEqual(record, original)
    assert.deepEqual(fromRow(toRow(record)), original)
  }
})

test('登録機の分類は meta.crop へ写り、分類のない登録情報では空のまま（探すのチップに載せる規約）', () => {
  assert.equal(REPAIR_MACHINES[0].category, '野菜関連機器')
  assert.equal(newRepairRecord(REPAIR_MACHINES[0]).meta.crop, '野菜関連機器')
  assert.equal(newRepairRecord(a).meta.crop, '')
  assert.equal(newFreeRepairRecord('ヤンマー YT225').meta.crop, '')
  assert.throws(() => createRepairRegistry([{ ...a, category: 7 }]), /登録情報/)
})
