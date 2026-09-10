// 型式アトラス工程Aの最小実行系。
//   node scripts/atlas/run.mjs "ホンダ F220"                     … 実データ（公開HTTPS）
//   node scripts/atlas/run.mjs "テスト工業 TK-100" --fixture scripts/atlas/fixtures/tk100
// 処理は 特定→収集→抽出→生成→検査。結果と全出所・時間・費用・介入を atlas-out/<jobId>/ に記録する。
// fixtureはモック（UI・機構確認用）であり、実データの自動生成成功としては数えない。
import { mkdir, writeFile } from 'node:fs/promises'
import { identify, sha256, MAKERS } from './registry.mjs'
import { createFetcher } from './net.mjs'
import { collectMaterials } from './collect.mjs'
import { extractSpec, extractPartNames, inferCategory } from './extract.mjs'
import { assembleMachine } from './assemble.mjs'
import { buildGlb } from './glb.mjs'
import { verifyMachine } from './verify.mjs'

const input = process.argv[2]
const fixtureAt = process.argv.indexOf('--fixture')
const fixtureDir = fixtureAt > -1 ? process.argv[fixtureAt + 1] : null
if (!input) { console.error('使い方: node scripts/atlas/run.mjs "メーカー名 型式" [--fixture dir]'); process.exit(2) }

const job = { input, mode: fixtureDir ? 'fixture(mock)' : 'live', startedAt: new Date().toISOString(), phases: {}, costJpy: 0, paidApiCalls: 0, interventions: [], status: 'running' }
const phase = async (name, fn) => { const t = Date.now(); try { return await fn() } finally { job.phases[name] = { ms: Date.now() - t } } }
const finish = async (status, extra = {}) => {
  Object.assign(job, { status, finishedAt: new Date().toISOString() }, extra)
  const jobId = `${job.machineId || 'unknown'}-${Date.now().toString(36)}`
  const dir = new URL(`../../atlas-out/${jobId}/`, import.meta.url)
  await mkdir(dir, { recursive: true })
  const files = job.artifacts?.files
  if (job.artifacts) delete job.artifacts.files
  await writeFile(new URL('job.json', dir), JSON.stringify(job, null, 2))
  if (files) for (const [name, data] of Object.entries(files)) await writeFile(new URL(name, dir), data)
  console.log(JSON.stringify({ jobId, ...job }, (k, v) => k === 'body' ? undefined : v, 2))
  process.exit(status === 'available' || status === 'registered' ? 0 : 1)
}

// --- 特定 ---
const identified = await phase('identify', async () => identify(input))
if (identified.status === 'registered') await finish('registered', { machineId: identified.machine.machineId, modelVersion: identified.machine.modelVersion, note: '登録済み。保存されたモデルを再利用する。' })
if (identified.status === 'need-input') await finish('need-input', { note: '型式を読み取れない。製造番号と型式を混同していないか確認する。' })
job.machineId = identified.machineId
const maker = identified.parsed.maker
if (!maker && !fixtureDir) await finish('unknown-maker', { note: `メーカーを特定できない。接続部に登録済み: ${MAKERS.map(m => m.names[0]).join('・')}` })

// --- 収集 ---
const fetcher = createFetcher({ fixtureDir })
const roots = fixtureDir ? ['fixture://index.html'] : maker.roots
const collected = await phase('collect', () => collectMaterials(fetcher, { roots, modelToken: identified.parsed.modelToken, original: input }))
job.materials = collected.materials.map(({ body, ...rest }) => rest)
job.failures = collected.failures
if (!collected.materials.length) {
  const blocked = collected.failures.filter(f => f.status === 'network-blocked').length
  await finish(blocked && blocked >= collected.failures.length ? 'blocked-network' : 'insufficient-materials',
    { note: blocked ? '全取得が通信段階で遮断された（実行環境のegressポリシー）。資料不足とは区別する。' : '対象型式を確認できる資料を取得できなかった。別機種の代用は表示しない。' })
}

// --- 抽出 ---
const spec = await phase('extract', async () => extractSpec(collected.materials))
const partNames = extractPartNames(collected.materials)
const category = inferCategory(collected.materials)
job.extracted = { spec, partNames: partNames.map(p => p.name), category }

// --- 生成 ---
const assembled = await phase('assemble', async () => assembleMachine({ machineId: job.machineId, name: input.trim(), category, spec, partNames }))
if (assembled.status !== 'ok') await finish('insufficient-materials', { note: `生成に必要な根拠が不足: ${assembled.missing.join(', ')}` })
const materialsManifest = JSON.stringify(job.materials.map(m => m.sha256))
const modelVersion = `${job.machineId}@${sha256(materialsManifest).slice(0, 8)}`
const glb = await phase('glb', () => buildGlb(assembled.machine))

// --- 検査 ---
const verdict = await phase('verify', async () => verifyMachine(assembled.machine, glb))
if (!verdict.ok) await finish('failed-verification', { problems: verdict.problems })
job.artifacts = {
  modelVersion, glbSha256: sha256(glb), glbBytes: glb.length,
  parts: assembled.machine.parts.length, meshedParts: assembled.machine.parts.filter(p => p.slot).length,
  files: { 'machine.json': JSON.stringify({ ...assembled.machine, modelVersion }, null, 2), 'model.glb': glb },
}
await finish('available', { modelVersion, fidelity: assembled.machine.fidelity })
