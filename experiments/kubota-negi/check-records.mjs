import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { buildOverview } from '../../scripts/catalog-overview.mjs'
import { toRow, fromRow, matches, publicationProblems } from '../../src/domain.js'

const root = new URL('../../', import.meta.url)
const manifest = JSON.parse(await fs.readFile(new URL('./manifest.json', import.meta.url)))
const photos = JSON.parse(await fs.readFile(new URL('data/card-photos.json', root))).entries
for (const item of manifest.entries) {
  const entry = JSON.parse(await fs.readFile(new URL(item.path, root)))
  const record = buildOverview(entry, photos.find(photo => photo.id === item.id))
  const saved = JSON.parse(await fs.readFile(new URL(item.path.replace('.json', '.record.json'), root))).records[0]
  assert.deepEqual(record, saved)
  assert.deepEqual(publicationProblems(record), [])
  assert.deepEqual(fromRow(toRow(record, 'de300000-0000-4000-8000-000000000012')), record)
  for (const term of [...entry.models, 'ネギ', 'ねぎ']) assert.ok(matches(record, term), `${item.key}: ${term}`)
}
console.log(`${manifest.entries.length} records: saved data, source mapping and model/crop search passed`)
