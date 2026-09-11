import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { identify, parseInput, normalizeModelText } from '../scripts/atlas/registry.mjs'
import { createFetcher, classifyError } from '../scripts/atlas/net.mjs'
import { extractPdfText } from '../scripts/atlas/pdftext.mjs'
import { collectMaterials } from '../scripts/atlas/collect.mjs'
import { extractSpec, extractPartNames, inferCategory } from '../scripts/atlas/extract.mjs'
import { assembleMachine } from '../scripts/atlas/assemble.mjs'
import { buildGlb } from '../scripts/atlas/glb.mjs'
import { verifyMachine } from '../scripts/atlas/verify.mjs'

const FIXTURE = new URL('../scripts/atlas/fixtures/tk100', import.meta.url).pathname

test('台帳照合：登録済みSKPは確定し、未登録・不足入力は確定しない', () => {
  assert.equal(identify('クボタ SKP-101W').status, 'registered')
  assert.equal(identify('ｸﾎﾞﾀ SKP-101W').machine?.machineId ?? identify('クボタ　skp-101w').machine?.machineId, 'skp-101w')
  assert.equal(identify('').status, 'need-input')
  // 対象メーカーはクボタ・ヤンマー・イセキ。別表記（井関）も同一メーカーに解決する
  assert.equal(parseInput('ヤンマー YK450MR').maker?.key, 'yanmar')
  assert.equal(identify('ヤンマー YK450MR').status, 'unregistered')
  assert.equal(identify('ヤンマー YK450MR').machineId, 'yanmar-yk450mr')
  assert.equal(parseInput('イセキ KCR60').maker?.key, 'iseki')
  assert.equal(parseInput('井関 KCR60').maker?.key, 'iseki')
  // 対象外メーカー（ホンダ）はメーカー未確定として扱い、勝手に対象へ組み込まない
  assert.equal(parseInput('ホンダ F220').maker, null)
  // 未登録メーカーでも型式トークンを分離し、勝手にメーカーを確定しない
  const parsed = parseInput('テスト工業 TK-100')
  assert.equal(parsed.maker, null)
  assert.equal(parsed.modelToken, 'tk-100')
  assert.equal(normalizeModelText('ＴＫ－１００'), 'tk-100')
})

test('台帳照合：メーカー不一致の同型式文字列を別メーカーの登録機種へ解決しない', () => {
  // クボタ機種SKP-101Wの型式文字列を他メーカー名と組み合わせても、クボタへ解決しない
  assert.equal(identify('ヤンマー SKP-101W').status, 'unregistered')
  assert.equal(identify('イセキ SKP-101W').status, 'unregistered')
  // 対象外メーカー（ホンダ等）は登録機種の再利用経路でも拒否（メーカー未確定として返す）
  const honda = identify('ホンダ SKP-101W')
  assert.equal(honda.status, 'unregistered')
  assert.equal(honda.parsed.maker, null)
  // メーカー語なしの型式単独・正しいメーカーの組み合わせは従来どおり確定する
  assert.equal(identify('SKP-101W').status, 'registered')
  assert.equal(identify('クボタ SKP-101W').status, 'registered')
})

test('PDF本文抽出：ToUnicode CMap付きPDFから日本語本文をページ単位で取り出す', async () => {
  const buf = await readFile(new URL('../scripts/atlas/fixtures/tk100/manual-tk100.pdf', import.meta.url))
  const out = extractPdfText(buf)
  assert.equal(out.error, undefined)
  assert.equal(out.pageCount, 1)
  assert.ok(out.pages[0].includes('各部の名称'))
  assert.ok(out.pages[0].includes('エンジン'))
  assert.ok(/全 長 （mm）1180/.test(out.pages[0]))
  // PDFでないバイト列・空バッファは明示的に抽出不可を返す（推測で続行しない）
  assert.equal(extractPdfText(Buffer.from('not a pdf')).error, 'not-a-pdf')
})

test('寸法抽出：見出し側単位・分かち書き見出し（PDF諸元表形式）を扱う', () => {
  const material = (html) => ({ url: 'fixture://spec.html', sha256: 'x', body: html })
  const headUnit = extractSpec([material('全      長 （mm）2200 全 幅 （mm）950 全 高 （mm）1150 機 体 質 量 （kg）235')])
  assert.deepEqual([headUnit.lengthMm, headUnit.widthMm, headUnit.heightMm, headUnit.massKg], [2200, 950, 1150, 235])
  // PDFの複数型式併記：対象型式を含むページの値だけを使い、併記された別型式を記録する
  const pdfMaterial = {
    url: 'fixture://manual.pdf', sha256: 'y', pdf: true,
    pdfText: ['型式 TK-90 全 長 （mm）9999', '型式 TK-100 TK-100M 全 長 （mm）1180 全 幅 （mm）495 全 高 （mm）980'],
  }
  const spec = extractSpec([pdfMaterial], { modelToken: 'tk-100' })
  assert.equal(spec.lengthMm, 1180) // 対象型式のないページ（9999）の値を使わない
  assert.equal(spec.evidence[0].location, 'PDF 2ページ')
  assert.deepEqual(spec.evidence[0].ambiguousModels, ['tk100m'])
})

test('通信分類：DNS・TLS・タイムアウト・接続断・不明を区別する', () => {
  assert.equal(classifyError({ code: 'ENOTFOUND' }).kind, 'dns-error')
  assert.equal(classifyError({ cause: { code: 'EAI_AGAIN' } }).kind, 'dns-error')
  assert.equal(classifyError({ code: 'ETIMEDOUT' }).kind, 'timeout')
  assert.equal(classifyError({ code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', message: 'cert' }).kind, 'tls-error')
  assert.equal(classifyError({ message: 'certificate has expired' }).kind, 'tls-error')
  assert.equal(classifyError({ code: 'ECONNRESET' }).kind, 'connection-error')
  assert.equal(classifyError({ message: 'mystery' }).kind, 'unknown-error')
})

test('寸法抽出：結合形式（全長×全幅×全高）と単位の位置差を扱い、単位なしは採用しない', () => {
  const material = (html) => ({ url: 'fixture://spec.html', sha256: 'x', body: html })
  // ヤンマー等の諸元表にある「見出し側に単位」形式
  const headerUnit = extractSpec([material('<th>全長×全幅×全高（mm）</th><td>1,470×550×1,130</td>')])
  assert.deepEqual([headerUnit.lengthMm, headerUnit.widthMm, headerUnit.heightMm], [1470, 550, 1130])
  assert.equal(headerUnit.evidence.length, 3)
  // 数値側に単位
  const tailUnit = extractSpec([material('機体寸法 1180×495×980mm')])
  assert.deepEqual([tailUnit.lengthMm, tailUnit.widthMm, tailUnit.heightMm], [1180, 495, 980])
  // どちらにも単位がなければ採用しない（勝手に補完しない）
  const noUnit = extractSpec([material('<th>全長×全幅×全高</th><td>1470×550×1130</td>')])
  assert.equal(noUnit.lengthMm, undefined)
  // cmはmmへ換算
  const cm = extractSpec([material('全長 147cm 全幅 55cm 全高 113cm')])
  assert.deepEqual([cm.lengthMm, cm.widthMm, cm.heightMm], [1470, 550, 1130])
})

test('フィクスチャから収集→抽出→組立→GLB→検査が通る（モック・別集計）', async () => {
  const fetcher = createFetcher({ fixtureDir: FIXTURE })
  const collected = await collectMaterials(fetcher, { roots: ['fixture://index.html'], modelToken: 'tk-100', original: 'テスト工業 TK-100' })
  assert.equal(collected.materials.length, 4) // HTML3件＋本文照合済みPDF1件
  const spec = extractSpec(collected.materials)
  assert.deepEqual([spec.lengthMm, spec.widthMm, spec.heightMm, spec.massKg], [1180, 495, 980, 31])
  assert.ok(spec.evidence.length >= 3)
  const partNames = extractPartNames(collected.materials)
  assert.ok(partNames.some(p => p.name === 'エンジン') && partNames.every(p => p.evidence.url))
  assert.ok(!partNames.some(p => /です/.test(p.name)))
  assert.equal(inferCategory(collected.materials), 'walk-behind-tiller')
  const assembled = assembleMachine({ machineId: 'tk-100', name: 'テスト工業 TK-100', category: 'walk-behind-tiller', spec, partNames })
  assert.equal(assembled.status, 'ok')
  assert.equal(assembled.machine.fidelity, 'schematic-exterior')
  // 位置を確認できない部品はメッシュを持たず、資料へ案内する
  const unknown = assembled.machine.parts.filter(p => p.positional === 'unknown')
  assert.ok(unknown.length >= 1 && unknown.every(p => !p.slot && p.evidence.url))
  const glb = await buildGlb(assembled.machine)
  assert.equal(glb.readUInt32LE(0), 0x46546c67)
  const verdict = verifyMachine(assembled.machine, glb)
  assert.deepEqual(verdict, { ok: true, problems: [] })
})

test('寸法根拠がなければ組み立てず、検査は当て推量メッシュを拒否する', async () => {
  assert.equal(assembleMachine({ machineId: 'x', name: 'x', category: 'walk-behind-tiller', spec: { evidence: [] }, partNames: [] }).status, 'insufficient-materials')
  // 検査：根拠のない部品・位置不明なのにメッシュ持ちを検出する
  const fetcher = createFetcher({ fixtureDir: FIXTURE })
  const collected = await collectMaterials(fetcher, { roots: ['fixture://index.html'], modelToken: 'tk-100', original: 't' })
  const spec = extractSpec(collected.materials)
  const assembled = assembleMachine({ machineId: 'tk-100', name: 't', category: 'walk-behind-tiller', spec, partNames: extractPartNames(collected.materials) })
  const glb = await buildGlb(assembled.machine)
  const broken = structuredClone(assembled.machine)
  broken.parts[0].evidence = {}
  broken.parts.push({ id: 'ghost', name: '幽霊部品', slot: 'engine', positional: 'unknown', evidence: { url: 'fixture://x' } })
  broken.nodes.push({ ...broken.nodes[1] }) // ノードIDの重複（別部品への再利用）も検出する
  const verdict = verifyMachine(broken, glb)
  assert.equal(verdict.ok, false)
  assert.ok(verdict.problems.some(p => p.includes('根拠')) && verdict.problems.some(p => p.includes('位置不明')) && verdict.problems.some(p => p.includes('重複')))
})

test('取得の分類：egress遮断・不正URL・内部宛先を区別して記録する', async () => {
  const fetcher = createFetcher({})
  const bad = await fetcher.fetchText('http://example.com/')
  assert.equal(bad.status, 'refused-target') // httpsのみ
  const internal = await fetcher.fetchText('https://192.168.1.1/')
  assert.equal(internal.status, 'refused-target')
  const malformed = await fetcher.fetchText('not a url')
  assert.equal(malformed.status, 'bad-url')
})

test('列対応：複数型式の諸元表は対象列の値だけを採用し、確定できなければ採用しない', async () => {
  const { extractColumnTable } = await import('../scripts/atlas/extract.mjs')
  const table = `付表 主要諸元 販売型式名 TS552NG [TS552NCG] TS752NG [TS752NCG] PC752N [PC752NC] 機体寸法
    全長（ハンドル 3 段目） (mm) 1470 [1455] 1460 [1445] 1450 [1435]
    全幅（ハンドル幅） (mm) 615
    機体質量（重量） (kg) 74.5 [75.0] 76.5 [77.0] 87.0 [87.5] エンジン`
  // 対象が最終列：先頭列でなく対象列の値を採用する
  const last = extractColumnTable(table, 'pc752n')
  assert.equal(last.targetColumn, 2)
  assert.equal(last.found.lengthMm.value, 1450)
  assert.equal(last.found.massKg.value, 87)
  // []内の派生型式（クローラ仕様）を指定した場合は派生値
  assert.equal(extractColumnTable(table, 'pc752nc').found.lengthMm.value, 1435)
  // 1値の行は全列共通として採用する
  assert.equal(last.found.widthMm.value, 615)
  assert.equal(last.found.widthMm.column, '全型式共通')
  // 対象が列に無い表からは値を採用しない
  assert.equal(extractColumnTable(table, 'tk-100').targetColumn, -1)
  // 見出しと型式が連結した表（列の切れ目が確定できない）は列対応不能として採用しない
  const concat = extractColumnTable('販売型式名FTR70(-L)FTR90 全長 (mm)16301570', 'ftr70')
  assert.equal(concat.unresolvable, true)
  assert.equal(Object.keys(concat.found).length, 0)
  // extractSpec経由：値の数が列数と一致しない行は採用せず ambiguous に記録する
  const viaSpec = extractSpec([{ url: 'u', sha256: 's', pdf: true, pdfText: ['PC752N 販売型式名 TA10 TB20 PC752N 全長 (mm) 1470 1480'] }], { modelToken: 'pc752n' })
  assert.equal(viaSpec.lengthMm, undefined)
  assert.ok(viaSpec.ambiguous.some(a => /value-count/.test(a.reason)))
})

test('図の凡例：位置つきテキストから (n)→部品名 を対応付ける', async () => {
  const { parseLegend, runsToLines } = await import('../scripts/atlas/pdffigure.mjs')
  const runs = [
    { text: '(1)', x: 28, y: 216, size: 8 }, { text: '主クラッチレバー', x: 45, y: 216, size: 8 },
    { text: '........................', x: 111, y: 216, size: 8 }, { text: '13', x: 160, y: 216, size: 8 },
    { text: '(2)', x: 28, y: 206, size: 8 }, { text: 'メインスイッチ', x: 45, y: 206.4, size: 8 },
    { text: '(10)', x: 204, y: 216, size: 8 }, { text: 'トルクリミッター', x: 230, y: 216, size: 8 },
  ]
  assert.equal(runsToLines(runs).length, 2)
  const legend = parseLegend(runs)
  assert.equal(legend.get(1), '主クラッチレバー')
  assert.equal(legend.get(2), 'メインスイッチ')
  assert.equal(legend.get(10), 'トルクリミッター')
})

test('図画像：PNG予測子の解除とPNG書き出しが往復で一致する', async () => {
  const { unfilterImage, encodePng, downsample2 } = await import('../scripts/atlas/pdffigure.mjs')
  // 4x2 RGB・予測子つき（Sub/Up）
  const w = 4, h = 2
  const raw = Buffer.from([
    1, 10, 20, 30, 5, 5, 5, 5, 5, 5, 5, 5, 5,      // Sub行
    2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,          // Up行
  ])
  const img = unfilterImage({ data: raw, width: w, height: h, colors: 3, predictor: 15 })
  assert.equal(img.pixels[0], 10)
  assert.equal(img.pixels[3], 15) // Sub: 10+5
  assert.equal(img.pixels[w * 3], 11) // Up: 10+1
  const png = encodePng(img)
  assert.equal(png.readUInt32BE(16), w) // IHDR幅
  const half = downsample2({ pixels: Buffer.alloc(4 * 4 * 3, 100), w: 4, h: 4, channels: 3 })
  assert.equal(half.w, 2)
  assert.equal(half.pixels[0], 100)
})

test('生成・検査：資料図の位置（documented-2d）は位置根拠つきで通り、根拠なしは拒否する', async () => {
  const positionEvidence = { url: 'https://example.com/m.pdf', page: 18, marker: 15, imageXY: [100, 200], imageSize: [2899, 2363], figureSha256: 'f'.repeat(64), basis: 'leader-endpoint' }
  const partNames = [
    { name: '燃料タンク', evidence: { url: 'u', location: '凡例' }, positionEvidence },
    { name: 'マフラ', evidence: { url: 'u', location: '凡例' }, positionEvidence: { ...positionEvidence, marker: 19 } },
  ]
  const dimEvidence = ['lengthMm', 'widthMm', 'heightMm'].map(field => ({ field, url: 'https://example.com/m.pdf', excerpt: 'x' }))
  const assembled = assembleMachine({ machineId: 'x', name: 'x', category: 'walk-behind-tiller', spec: { lengthMm: 1470, widthMm: 615, heightMm: 1020, evidence: dimEvidence }, partNames })
  assert.equal(assembled.status, 'ok')
  const tank = assembled.machine.parts.find(p => p.name === '燃料タンク')
  assert.equal(tank.positional, 'documented-2d')
  assert.equal(tank.slot, 'fueltank') // 3D対象（配置自体はテンプレート推定と明示）
  assert.equal(tank.positionBasis, 'template-estimate')
  const muffler = assembled.machine.parts.find(p => p.name === 'マフラ')
  assert.equal(muffler.positional, 'documented-2d')
  assert.equal(muffler.slot, null)
  const glb = await buildGlb(assembled.machine)
  assert.deepEqual(verifyMachine(assembled.machine, glb), { ok: true, problems: [] })
  // 位置根拠を欠く documented-2d は検査で拒否する
  const broken = structuredClone(assembled.machine)
  delete broken.parts[0].positionEvidence
  assert.ok(verifyMachine(broken, glb).problems.some(p => p.includes('位置根拠')))
})
