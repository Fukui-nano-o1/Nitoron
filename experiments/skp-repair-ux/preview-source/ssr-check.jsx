import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RepairDetail } from './repo/src/RepairWorkspace.jsx'
import { newRepairRecord, REPAIR_MACHINES } from './repo/src/repair-workspace.mjs'
import RepairPilot from './repo/src/RepairPilot.jsx'
import RepairRecordInfo from './repo/src/RepairRecordInfo.jsx'
import RepairManagement from './repo/src/RepairManagement.jsx'
import { publicSnapshot } from './repo/src/domain.js'
import { PILOT_REF } from './repo/src/repair-pilot.mjs'
const record = newRepairRecord(REPAIR_MACHINES[0]); record.meta.machineRef = { ...PILOT_REF }
record.meta.issue = 'エンジンの出力が低下する'
record.meta.result = '確認できなかった。'
const detail = renderToStaticMarkup(<RepairDetail record={record} onSave={() => true} save={{ status: 'この端末に保存' }} />)
assert.match(detail, /修理対象の3D/); assert.match(detail, /エアクリーナ/)
assert.doesNotMatch(detail, /発表者|作物|面積|経営の数字|公開する|確認・公開/)
const unknown = structuredClone(record); unknown.meta.machineRef.machineId = 'unknown-brand/model'
const unknownHTML = renderToStaticMarkup(<RepairDetail record={unknown} />)
assert.match(unknownHTML, /この機種の3Dは未対応/); assert.doesNotMatch(unknownHTML, /症状を確認する<\/button>/)
const guide = renderToStaticMarkup(<RepairPilot meta={record.meta} onTransfer={() => true} onClose={() => {}} />)
assert.match(guide, /操作・説明書/); assert.doesNotMatch(guide, /平坦な場所で|30分以上経過/)
assert.match(guide, /条件と操作を確認/)
const edited = structuredClone(record); edited.meta.issue = '別の症状'
assert.doesNotMatch(renderToStaticMarkup(<RepairDetail record={edited} />), /症状を確認する<\/button>/)
const historical = structuredClone(record)
historical.meta.observations = [{ id: 'obs', date: '2026-09-13', fact: '観測した値', conditions: '観測条件', evidence: '観測の原典' }]
historical.meta.origin = { id: 'secret-origin-id', title: '秘密の題名', public: false }
historical.meta.hypothesis = '未確定の仮説'
const info = renderToStaticMarkup(<RepairRecordInfo record={publicSnapshot(historical)} />)
for (const value of ['観測した値', '観測条件', '観測の原典', '未確定の仮説', '2026-09-13']) assert.ok(info.includes(value))
assert.doesNotMatch(info, /secret-origin-id|秘密の題名|作物・品種|対象面積/)
const manager = renderToStaticMarkup(<RepairManagement record={record} management={{ known: true, published: true, session: { user: {} } }} onClose={() => {}} />)
for (const label of ['公開を停止', '公開版を更新', '記録を削除']) assert.ok(manager.includes(label))
fs.writeFileSync(new URL('./ssr-evidence.json', import.meta.url), JSON.stringify({ date: '2026-09-13', checks: 6, passed: 6, scope: 'server-rendered markup only', browser: false, assertions: ['repair detail excludes presentation fields', 'saved part and model-unavailable state render', 'guide initial text is collapsed behind controls', 'unrelated symptom does not open power-loss guide', 'historical observations remain readable without private origin disclosure', 'existing publication management remains reachable'] }, null, 2))
console.log('SSR UI contracts: 6/6; browser rendering not tested')
