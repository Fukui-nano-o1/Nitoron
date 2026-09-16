import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { buildOverview, catalogId } from '../../scripts/catalog-overview.mjs'
import { fromRow, toRow, publicSnapshot, matches } from '../../src/domain.js'
import { isCatalogRecord, parseCatalogTitle } from '../../src/catalog-domain.js'

const root = new URL('../../', import.meta.url)
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const manifestPath = process.argv[2] || 'experiments/kubota-historical-tractors/source-checks.json'
const manifest = await read(manifestPath)
const photos = (await read('data/card-photos.json')).entries
assert.equal(manifest.entries.length, 10)
const models = manifest.entries.map(entry => entry.model)
assert.equal(new Set(models).size, 10)
const normalizeModel = value => value.normalize('NFKC').toUpperCase().replace(/[-‐‑–—\s]/g, '')
const candidatePaths = new Set(manifest.entries.map(entry => entry.path))
const existingRecords = []
const existingModels = new Set()
for (const maker of await readdir(new URL('data/catalog/', root))) {
  for (const file of await readdir(new URL(`data/catalog/${maker}/`, root))) {
    if (!file.endsWith('.json') || file.endsWith('.check.json')) continue
    const path = `data/catalog/${maker}/${file}`
    if (candidatePaths.has(path.replace(/\.record\.json$/, '.json'))) continue
    const data = await read(path)
    if (file.endsWith('.record.json')) existingRecords.push(...data.records)
    else if (data.maker === 'クボタ') for (const model of [data.series, data.salesModel, ...(data.models || [])].filter(Boolean)) existingModels.add(normalizeModel(model))
  }
}
const checks = []
for (const item of manifest.entries) {
  const entry = await read(item.path)
  assert.equal(entry.coverage, 'historical-overview')
  assert.equal(entry.series, item.model)
  assert.equal(existingModels.has(normalizeModel(item.model)), false, `既存の型式: ${item.model}`)
  const record = (await read(item.path.replace(/\.json$/, '.record.json'))).records[0]
  const photo = photos.find(photo => photo.id === record.id)
  assert.deepEqual(record, buildOverview(entry, photo))
  assert.equal(record.id, catalogId(entry.maker, entry.series))
  assert.equal(existingRecords.some(other => other.id === record.id || other.title === record.title), false)
  // シリーズ内の対象型式や別名にも候補が含まれていないか照合する。
  const token = new RegExp(`(^|[^A-Z0-9])${item.model}($|[^A-Z0-9])`)
  assert.equal(existingRecords.some(other => token.test(normalizeModel(JSON.stringify(other)))), false, `既存カード本文にある型式: ${item.model}`)
  const roundTrip = fromRow(toRow(record))
  assert.equal(isCatalogRecord(roundTrip), true)
  assert.equal(parseCatalogTitle(roundTrip.title).model, item.model)
  assert.deepEqual(publicSnapshot(roundTrip), publicSnapshot(record))
  assert.equal(matches(roundTrip, item.model), true)
  assert.equal(matches(roundTrip, item.model.replace(/([A-Z]+)(\d)/, '$1-$2')), true)
  assert.equal(record.meta.sources.length, photo ? 4 : 3)
  assert.equal(record.meta.coverUrl, photo?.url || '')
  checks.push({ model: item.model, id: record.id, duplicate: false, roundTrip: true, searchable: true, sources: record.meta.sources.length, photo: !!photo })
}
assert.equal(new Set(checks.map(check => check.id)).size, 10)
const result = { checkedAt: manifest.checkedAt, additions: checks.length, duplicateCount: 0, checks }
await writeFile(new URL(manifestPath.replace(/source-checks\.json$/, 'record-checks.json'), root), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
