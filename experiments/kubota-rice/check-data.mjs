// Re-run from the repository root: node experiments/kubota-rice/check-data.mjs
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { buildOverview, validateOverview, catalogId } from '../../scripts/catalog-overview.mjs'
import { fromRow, toRow, matches, publicationProblems } from '../../src/domain.js'
const root = new URL('../../', import.meta.url)
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), 'utf8'))
const coverage = await read('experiments/kubota-rice/coverage.json')
const photos = (await read('data/card-photos.json')).entries
const photoChecks = await read('experiments/kubota-rice/photo-checks.json')
const sources = await read('experiments/kubota-rice/source-checks.json')
assert.equal(coverage.additions.length, 65)
assert.equal(coverage.additions.length + coverage.existing.length, 71)
assert.equal(new Set(coverage.additions.map(p => p.id)).size, 65)
let modelCount = 0, facilityCount = 0
for (const p of coverage.additions) {
  const e = await read(p.path)
  const photo = photos.find(x => x.id === p.id)
  const record = buildOverview(e, photo)
  assert.equal(p.id, catalogId(e.maker, e.series))
  assert.equal(e.sources.product.url, p.source)
  assert.equal(photoChecks.find(x => x.key === p.key).url, photo.url)
  assert.equal(sources.find(x => x.key === p.key).status, 200)
  assert.deepEqual(publicationProblems(record), [])
  assert.equal(record.meta.machineRef, null)
  assert.deepEqual(fromRow(toRow(record)), record)
  assert.deepEqual((await read(p.path.replace('.json', '.record.json'))).records, [record])
  for (const model of e.models) assert.ok(matches(record, model), model)
  modelCount += e.models.length
  if (e.modelPolicy === 'project-specific') {
    facilityCount++
    assert.throws(() => validateOverview({ ...e, modelPolicy: undefined }, photo))
    assert.throws(() => validateOverview({ ...e, models: ['made-up-model'] }, photo))
    assert.ok(record.blocks.some(b => b.text === '施設の構成'))
  }
  if (e.sources.catalog.availability === 'not-listed') {
    assert.throws(() => validateOverview({ ...e, sources: { ...e.sources, catalog: {} } }, photo))
    assert.ok(!record.meta.sources.some(s => s.id.endsWith('-src-catalog')))
  }
  assert.ok(record.meta.sources.every(s => s.title && s.url.startsWith('https://')))
}
for (const p of coverage.existing) assert.equal((await read(p.path)).sources.product.url, p.source)
assert.equal(facilityCount, 3)
console.log(JSON.stringify({ newCards: 65, coveredListings: 71, listedModelNotations: modelCount, facilities: facilityCount, result: 'passed' }))
