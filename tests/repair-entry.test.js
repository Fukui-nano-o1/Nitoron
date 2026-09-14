import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyRepair, sanitizeRepair, hasRepairContent, repairProblems, createRepairEntryDraft, repairHeadline, repairMachineLabel, repairMarkdown, REPAIR_OUTCOMES } from '../src/repair-entry.mjs'
import { fromRow, toRow, publicSnapshot, publicationProblems, exportMarkdown, newRecord, sanitizeMeta } from '../src/domain.js'
import { REPAIR_MACHINES, newRepairRecord, newFreeRepairRecord, isRepairRecord } from '../src/repair-workspace.mjs'

const filledRepair = () => ({
  machine: { maker: '架空メーカー', model: 'ZX-9', serial: '2019年式', hours: '350' },
  symptom: { text: '始動後すぐ止まる', since: '2026-09-01', when: '暖機後の負荷時' },
  checks: [{ id: 'c1', part: 'エアクリーナー', finding: 'ほこりの詰まりが見える', basis: '取説 印刷p.20' }],
  actions: [{ id: 'a1', date: '2026-09-10', what: 'エレメントを清掃した', parts: '', cost: '0', minutes: '15' }],
  outcome: { status: 'improved', note: '翌日の始動で停止しなかった', recheckOn: '2026-09-20' },
})

test('修理の内容は欠けた項目を空で補い、未知の項目と不正な状態を捨てる', () => {
  assert.deepEqual(sanitizeRepair(undefined), emptyRepair())
  assert.deepEqual(sanitizeRepair('x'), emptyRepair())
  const r = sanitizeRepair({ machine: { maker: 'A', extra: 1 }, symptom: { text: 3 }, checks: [{ part: 'x' }, 'bad', null], actions: [{ what: 'y', cost: 120 }], outcome: { status: 'bogus', note: 'n' } })
  assert.equal(r.machine.maker, 'A'); assert.equal(r.machine.model, ''); assert.equal('extra' in r.machine, false)
  assert.equal(r.symptom.text, '3')
  assert.equal(r.checks.length, 1); assert.match(r.checks[0].id, /^[0-9a-f-]{36}$/); assert.equal(r.checks[0].finding, '')
  assert.equal(r.actions[0].cost, '120'); assert.equal(r.actions[0].date, '')
  assert.equal(r.outcome.status, ''); assert.equal(r.outcome.note, 'n')
  assert.equal(hasRepairContent(emptyRepair()), false); assert.equal(hasRepairContent(r), true)
  assert.equal(repairHeadline(filledRepair()), '始動後すぐ止まる'); assert.equal(repairMachineLabel(filledRepair()), '架空メーカー ZX-9')
})

test('数値・日付・結果の整合だけを検査し、空欄は問題にしない', () => {
  assert.deepEqual(repairProblems(emptyRepair()), [])
  assert.deepEqual(repairProblems(filledRepair()), [])
  const bad = filledRepair()
  bad.machine.hours = '-1'; bad.actions[0].date = '2026-02-30'; bad.actions[0].cost = 'abc'; bad.outcome.recheckOn = '2026/09/20'
  const problems = repairProblems(bad)
  assert.match(problems.join('\n'), /稼働時間/); assert.match(problems.join('\n'), /対処1の日付/); assert.match(problems.join('\n'), /対処1の費用/); assert.match(problems.join('\n'), /次回の確認日/)
  const noAction = { ...emptyRepair(), outcome: { status: 'unchanged', note: '', recheckOn: '' } }
  assert.match(repairProblems(noAction).join('\n'), /行ったことを1件以上/)
  assert.match(repairProblems({ ...emptyRepair(), outcome: { status: 'bogus', note: '', recheckOn: '' } }).join('\n'), /選び直して/)
  assert.match(repairProblems({ ...emptyRepair(), symptom: { text: 'a'.repeat(4001), since: '', when: '' } }).join('\n'), /症状は4000文字以内/)
})

test('入力シートの保存案は別の操作による変更を止め、失敗した案は置き換える', () => {
  const record = newRepairRecord(REPAIR_MACHINES[0])
  const draft = createRepairEntryDraft(record.meta)
  assert.deepEqual(draft.initial, record.meta.repair)
  const first = draft.prepare(record.meta, filledRepair())
  assert.equal(first.repair.symptom.text, '始動後すぐ止まる'); assert.equal(first.machineRef.machineId, 'skp-101w')
  assert.equal(record.meta.repair.symptom.text, '', '元の記録は変えない')
  const revised = draft.prepare(first, { ...filledRepair(), symptom: { text: '始動しない', since: '', when: '' } })
  assert.equal(revised.repair.symptom.text, '始動しない')
  assert.throws(() => draft.prepare({ ...record.meta, issue: '別の操作で変更' }, filledRepair()), /別の操作/)
  assert.throws(() => draft.prepare(record.meta, { ...filledRepair(), actions: [{ id: 'a', date: 'x', what: 'y', parts: '', cost: '', minutes: '' }] }), /日付/)
})

test('修理記録は登録機種でも登録のない機械でも既存の保存形式で往復し、公開スナップショットに残る', () => {
  const registered = newRepairRecord(REPAIR_MACHINES[0])
  assert.deepEqual(registered.meta.repair.machine, { maker: 'クボタ', model: 'SKP-101W', serial: '', hours: '' })
  const free = newFreeRepairRecord('  ヤンマー YK450MR  ')
  assert.equal(isRepairRecord(free), true); assert.equal(free.meta.machineRef, null); assert.equal(free.title, 'ヤンマー YK450MR'); assert.equal(free.meta.repair.machine.model, 'ヤンマー YK450MR')
  assert.equal(newFreeRepairRecord('').title, '機械の修理')
  for (const record of [registered, free]) {
    record.meta.repair = filledRepair()
    const restored = fromRow(toRow(record, 'owner'))
    assert.deepEqual(restored, record)
    assert.deepEqual(publicSnapshot(record).meta.repair, filledRepair())
    assert.deepEqual(publicationProblems(record), [])
    record.meta.repair.outcome.recheckOn = 'bad'
    assert.deepEqual(publicationProblems(record), ['次回の確認日を確認してください。'])
    record.meta.repair.outcome.recheckOn = ''
    const md = exportMarkdown(record)
    assert.match(md, /## 修理の内容/); assert.match(md, /エアクリーナー: ほこりの詰まりが見える（根拠: 取説 印刷p\.20）/); assert.match(md, new RegExp(REPAIR_OUTCOMES.improved))
  }
  assert.deepEqual(repairMarkdown(emptyRepair()), [])
})

test('修理以外の記録は修理の内容を持たず、混入した値も保持しない', () => {
  const presentation = newRecord('presentation')
  assert.equal(presentation.meta.repair, null)
  const restored = fromRow(toRow(presentation))
  assert.equal(restored.meta.repair, null)
  const mixed = sanitizeMeta({ ...presentation.meta, repair: filledRepair() })
  assert.equal(mixed.repair, null)
  // 旧修理記録（repair なし）は空の修理内容で開き、症状の旧項目はそのまま残す
  const legacy = sanitizeMeta({ ...presentation.meta, subject: 'machine_repair', issue: '異音がする' })
  assert.deepEqual(legacy.repair, emptyRepair()); assert.equal(legacy.issue, '異音がする')
  assert.equal(exportMarkdown({ ...presentation, meta: legacy }).includes('## 修理の内容'), false)
})
