// 型式アトラス工程Aの最小実行系。
//   node scripts/atlas/run.mjs "クボタ PC752N"                   … 実データ（公開HTTPS）
//   node scripts/atlas/run.mjs "テスト工業 TK-100" --fixture scripts/atlas/fixtures/tk100
// 処理は 特定→収集→抽出→位置→生成→検査。結果と全出所・時間・費用・介入を atlas-out/<jobId>/ に記録する。
// fixtureはモック（UI・機構確認用）であり、実データの自動生成成功としては数えない。
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { identify, sha256, MAKERS } from './registry.mjs'
import { createFetcher } from './net.mjs'
import { collectMaterials } from './collect.mjs'
import { extractSpec, extractPartNames, inferCategory } from './extract.mjs'
import { extractPartPositions } from './pdffigure.mjs'
import { assembleMachine } from './assemble.mjs'
import { buildGlb } from './glb.mjs'
import { verifyMachine } from './verify.mjs'
import { buildViewerHtml } from './viewer.mjs'

const input = process.argv[2]
const fixtureAt = process.argv.indexOf('--fixture')
const fixtureDir = fixtureAt > -1 ? process.argv[fixtureAt + 1] : null
if (!input) { console.error('使い方: node scripts/atlas/run.mjs "メーカー名 型式" [--fixture dir]'); process.exit(2) }

const job = { input, mode: fixtureDir ? 'fixture(mock)' : 'live', startedAt: new Date().toISOString(), phases: {}, costJpy: 0, paidApiCalls: 0, interventions: [], status: 'running' }
const phase = async (name, fn) => { const t = Date.now(); try { return await fn() } finally { job.phases[name] = { ms: Date.now() - t } } }
let jobDir = null
const ensureJobDir = async () => {
  if (jobDir) return jobDir
  const jobId = `${job.machineId || 'unknown'}-${Date.now().toString(36)}`
  jobDir = new URL(`../../atlas-out/${jobId}/`, import.meta.url)
  job.jobId = jobId
  await mkdir(jobDir, { recursive: true })
  return jobDir
}
const finish = async (status, extra = {}) => {
  Object.assign(job, { status, finishedAt: new Date().toISOString() }, extra)
  const dir = await ensureJobDir()
  const files = job.artifacts?.files
  if (job.artifacts) delete job.artifacts.files
  await writeFile(new URL('job.json', dir), JSON.stringify(job, null, 2))
  if (files) for (const [name, data] of Object.entries(files)) await writeFile(new URL(name, dir), data)
  console.log(JSON.stringify(job, (k, v) => k === 'body' ? undefined : v, 2))
  process.exit(status === 'available' || status === 'registered' ? 0 : 1)
}

// --- 特定 ---
const identified = await phase('identify', async () => identify(input))
if (identified.status === 'registered') await finish('registered', { machineId: identified.machine.machineId, modelVersion: identified.machine.modelVersion, note: '登録済み。保存されたモデルを再利用する。' })
if (identified.status === 'need-input') await finish('need-input', { note: '型式を読み取れない。製造番号と型式を混同していないか確認する。' })
job.machineId = identified.machineId
const maker = identified.parsed.maker
if (!maker && !fixtureDir) await finish('unknown-maker', { note: `対象メーカー外か特定できない。現在の対象: ${MAKERS.map(m => m.names[0]).join('・')}` })
await ensureJobDir()

// --- 収集 ---
const fetcher = createFetcher({ fixtureDir })
// メーカーの検索入口（機種横断テンプレート。機種専用URLの手入力ではない）を優先し、次にメーカールートを探索する
const searchUrls = fixtureDir ? [] : (maker.searches || []).map(u => u.replace('{model}', encodeURIComponent(identified.parsed.modelToken)))
const roots = fixtureDir ? ['fixture://index.html'] : [...searchUrls, ...maker.roots]
const collected = await phase('collect', () => collectMaterials(fetcher, { roots, modelToken: identified.parsed.modelToken, original: input }))
job.materials = collected.materials.map(({ body, pdfText, ...rest }) => ({ ...rest, pdfPagesExtracted: pdfText ? pdfText.length : undefined }))
job.failures = collected.failures
job.unusablePdfs = collected.unusablePdfs
if (!collected.materials.length) {
  // 失敗の内訳で終了状態を分ける：egressポリシー拒否／サイト側拒否（4xx等）／資料不足
  const statuses = collected.failures.map(f => f.status)
  const policy = statuses.filter(s => s === 'network-blocked').length
  const site = collected.failures.filter(f => f.refusedBy === 'site').length
  const status = statuses.length && policy >= statuses.length ? 'blocked-network'
    : statuses.length && site >= statuses.length ? 'blocked-by-site'
    : 'insufficient-materials'
  const notes = {
    'blocked-network': '全取得が実行環境のegressポリシーで遮断された。資料不足・サイト側拒否とは区別する。',
    'blocked-by-site': '接続は許可されたが、取得先サイト側がHTTPエラーで拒否した（応答サーバーはfailuresに記録）。資料不足・ポリシー遮断とは区別する。',
    'insufficient-materials': '対象型式を確認できる資料を取得できなかった。別機種の代用は表示しない。',
  }
  await finish(status, { note: notes[status] })
}

// --- 抽出（諸元・部品名・カテゴリ） ---
const spec = await phase('extract', async () => extractSpec(collected.materials, { modelToken: identified.parsed.modelToken }))
const partNames = extractPartNames(collected.materials)
const category = inferCategory(collected.materials)
job.extracted = { spec, category }
// 複数型式表で対象列との対応を確定できず、寸法が得られない場合は曖昧として生成を停止する
if (!(spec.lengthMm > 0 && spec.widthMm > 0 && spec.heightMm > 0) && spec.ambiguous?.length) {
  await finish('ambiguous-spec', { note: '諸元表の列（型式）との対応を確定できなかったため、値を採用せず生成を停止した。先頭列の値では続行しない。', ambiguous: spec.ambiguous })
}

// --- 位置（各部の名称の図：凡例＋OCR＋引出線追跡。すべて資料由来） ---
const figures = []
if (!fixtureDir) await phase('positions', async () => {
  for (const material of collected.materials.filter(m => m.pdf && Buffer.isBuffer(m.body))) {
    const res = extractPartPositions(material.body, { workDir: fileURLToPath(jobDir) })
    if (res.error) { job.figureIssues = [...(job.figureIssues || []), { url: material.url, error: res.error, detail: res.detail }]; continue }
    for (const figure of res.figures) figures.push({ materialUrl: material.url, materialSha: material.sha256, ...figure })
    if (res.errors?.length) job.figureIssues = [...(job.figureIssues || []), ...res.errors.map(e => ({ url: material.url, ...e }))]
  }
})
job.figures = figures.map(f => ({ materialUrl: f.materialUrl, page: f.page, image: { width: f.image.width, height: f.image.height, sha256: f.image.sha256, pdfObject: f.image.pdfObject }, positions: f.positions.length }))
// 図から得た位置を部品名に対応付ける（凡例のみに出る部品名は追加する）
const positionByName = new Map()
for (const f of figures) for (const p of f.positions) {
  if (positionByName.has(p.name)) continue
  positionByName.set(p.name, {
    url: f.materialUrl, sha256: f.materialSha, page: f.page, marker: p.marker,
    imageXY: [p.x, p.y], markerXY: p.markerXY, imageSize: [f.image.width, f.image.height],
    figureSha256: f.image.sha256, basis: p.basis, ocrConf: p.ocrConf,
  })
}
for (const part of partNames) if (positionByName.has(part.name)) part.positionEvidence = positionByName.get(part.name)
for (const [name, pe] of positionByName) if (!partNames.some(p => p.name === name)) {
  partNames.push({ name, evidence: { url: pe.url, sha256: pe.sha256, location: `各部の名称（PDF ${pe.page}ページ 凡例）` }, positionEvidence: pe })
}
job.extracted.partNames = partNames.map(p => p.name)

// --- 生成 ---
const assembled = await phase('assemble', async () => assembleMachine({ machineId: job.machineId, name: input.trim(), category, spec, partNames }))
if (assembled.status !== 'ok') await finish('insufficient-materials', { note: `生成に必要な根拠が不足: ${assembled.missing.join(', ')}` })
const materialsManifest = JSON.stringify(job.materials.map(m => m.sha256))
const modelVersion = `${job.machineId}@${sha256(materialsManifest).slice(0, 8)}`
const glb = await phase('glb', () => buildGlb(assembled.machine))

// --- 検査 ---
const verdict = await phase('verify', async () => verifyMachine(assembled.machine, glb))
if (!verdict.ok) await finish('failed-verification', { problems: verdict.problems })
// 部品照合表：名称の根拠（資料URL・該当箇所）と、位置の主張水準（資料照合済み／推定／未確認）を分けて記録する。
// テンプレート推定配置は「資料照合済みの位置」として数えない。
job.partsReport = assembled.machine.parts.map(part => ({
  name: part.name, partId: part.id, marker: part.positionEvidence?.marker ?? null,
  evidenceUrl: part.evidence?.url ?? null, evidenceLocation: part.evidence?.location ?? null,
  nameBasis: part.evidence?.url ? '資料に名称の記載あり' : '根拠なし',
  positionBasis: /^documented/.test(part.positional)
    ? `資料の図で位置確認（PDF ${part.positionEvidence.page}ページ 符号(${part.positionEvidence.marker})・${part.positionEvidence.basis === 'leader-endpoint' ? '引出線の指し先' : '符号の位置'}）`
    : part.slot ? '推定（テンプレート比率配置・資料未照合）' : '未確認（メッシュなし・資料案内のみ）',
  documented: /^documented/.test(part.positional),
  meshTarget: part.slot ?? null,
}))
// --- ビューア（スマホ確認用・単一HTML） ---
const viewerFigures = []
for (const f of figures) {
  const png = await readFile(f.image.previewFile || f.image.pngFile)
  viewerFigures.push({ page: f.page, width: f.image.width, height: f.image.height, sha256: f.image.sha256, dataUri: 'data:image/png;base64,' + png.toString('base64'), positions: f.positions })
}
const viewerHtml = buildViewerHtml({ machine: { ...assembled.machine, modelVersion }, partsReport: job.partsReport, figures: viewerFigures, glbBase64: glb.toString('base64'), job: { input, modelVersion } })
job.artifacts = {
  modelVersion, glbSha256: sha256(glb), glbBytes: glb.length,
  parts: assembled.machine.parts.length, meshedParts: assembled.machine.parts.filter(p => p.slot).length,
  documentedParts: assembled.machine.parts.filter(p => /^documented/.test(p.positional)).length,
  viewer: 'viewer.html',
  files: { 'machine.json': JSON.stringify({ ...assembled.machine, modelVersion }, null, 2), 'model.glb': glb, 'viewer.html': viewerHtml },
}
await finish('available', { modelVersion, fidelity: assembled.machine.fidelity })
