import test from 'node:test'
import assert from 'node:assert/strict'
import { identify, parseInput, normalizeModelText } from '../scripts/atlas/registry.mjs'
import { createFetcher } from '../scripts/atlas/net.mjs'
import { collectMaterials } from '../scripts/atlas/collect.mjs'
import { extractSpec, extractPartNames, inferCategory } from '../scripts/atlas/extract.mjs'
import { assembleMachine } from '../scripts/atlas/assemble.mjs'
import { buildGlb } from '../scripts/atlas/glb.mjs'
import { verifyMachine } from '../scripts/atlas/verify.mjs'

const FIXTURE = new URL('../scripts/atlas/fixtures/tk100', import.meta.url).pathname

test('台帳照合：登録済みSKPは確定し、未登録・不足入力は確定しない', () => {
  assert.equal(identify('クボタ SKP-101W').status, 'registered')
  assert.equal(identify('ｸﾎﾞﾀ SKP-101W').machine?.machineId ?? identify('クボタ　skp-101w').machine?.machineId, 'skp-101w')
  assert.equal(identify('ホンダ F220').status, 'unregistered')
  assert.equal(identify('ホンダ F220').machineId, 'honda-f220')
  assert.equal(identify('').status, 'need-input')
  // 未登録メーカーでも型式トークンを分離し、勝手にメーカーを確定しない
  const parsed = parseInput('テスト工業 TK-100')
  assert.equal(parsed.maker, null)
  assert.equal(parsed.modelToken, 'tk-100')
  assert.equal(normalizeModelText('ＴＫ－１００'), 'tk-100')
})

test('フィクスチャから収集→抽出→組立→GLB→検査が通る（モック・別集計）', async () => {
  const fetcher = createFetcher({ fixtureDir: FIXTURE })
  const collected = await collectMaterials(fetcher, { roots: ['fixture://index.html'], modelToken: 'tk-100', original: 'テスト工業 TK-100' })
  assert.equal(collected.materials.length, 3)
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
  const verdict = verifyMachine(broken, glb)
  assert.equal(verdict.ok, false)
  assert.ok(verdict.problems.some(p => p.includes('根拠')) && verdict.problems.some(p => p.includes('位置不明')))
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
