import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { buildOverview, catalogId } from '../../scripts/catalog-overview.mjs'
const root = new URL('../../', import.meta.url)
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const manifest = await read('experiments/kubota-kt-series/source-checks.json')
const pages = await read('experiments/kubota-kt-series/index-pages.json')
const related = await read('experiments/kubota-kt-series/related-documents.json')
const photos = (await read('data/card-photos.json')).entries
const evidence = await read('experiments/kubota-kt-series/photo-checks.json')
const manualPages = pages.filter(p => p.kind === 'manual')
const manualRows = manualPages.flatMap(p => p.rows)
const tractorRows = manualRows.filter(row => row.category === 'トラクタ')
const indexedModels = tractorRows.filter(row => /^KT\d+$/.test(row['spec-id'])).map(row => row['spec-id']).sort()
assert.equal(manualPages.length, 3)
assert.equal(manualRows.length, 62)
assert.equal(tractorRows.length, 59)
assert.equal(indexedModels.length, 15)
assert.deepEqual(manifest.entries.map(x => x.model).sort(), indexedModels)
const catalogModels = (await readdir(new URL('data/catalog/kubota/', root))).filter(f => /^kt\d+\.json$/.test(f)).map(f => f.replace('.json', '').toUpperCase()).sort()
assert.deepEqual(catalogModels, indexedModels)
assert.deepEqual(related.documents.map(d => [d.title, d.noticeUrl]).sort(), tractorRows.map(r => [r['spec-id'], r.manualUrl]).sort())
assert.equal(related.salesRows.length, 26)
assert.equal(evidence.entries.length, 15)
assert.equal(new Set(evidence.entries.map(p => p.imageSha256)).size, 15)
let manuals = 0, salesRows = 0
for (const item of manifest.entries) {
  const entry = await read(item.path)
  const photo = photos.find(p => p.id === catalogId(entry.maker, entry.series))
  const record = (await read(item.path.replace(/\.json$/, '.record.json'))).records[0]
  assert.deepEqual(record, buildOverview(entry, photo))
  const expectedDocs = related.documents.filter(d => d.baseModel === item.model)
  const actualDocs = [...entry.sources.manuals, ...entry.sources.relatedManuals]
  assert.deepEqual(actualDocs.map(d => [d.title, d.url]).sort(), expectedDocs.map(d => [d.title, d.noticeUrl]).sort())
  assert.deepEqual(actualDocs.map(d => [item.model, d.title, d.kind || 'base', d.url, d.sha256]).sort(), expectedDocs.map(d => [d.baseModel, d.title, d.docKind, d.noticeUrl, d.noticeCheck.sha256]).sort())
  assert(expectedDocs.every(d => d.noticeCheck.status === 200))
  for (const document of actualDocs) assert(record.meta.sources.some(s => s.url === document.url))
  const periods = [entry.sources.salesIndex.result, ...(entry.sources.salesIndex.variants || [])]
  assert.deepEqual(periods.map(p => [p.model, p.startYear, p.endYear]).sort(), related.salesRows.filter(p => p.baseModel === item.model).map(p => [p.model, p.startYear, p.endYear]).sort())
  const checked = evidence.entries.find(p => p.model === item.model)
  assert.equal(photo.url, checked.imageUrl)
  assert.equal(photo.source.url, checked.sourceUrl)
  assert.equal(checked.imageStatus, 200)
  assert.equal(checked.sourceStatus, 200)
  assert(checked.width >= 240 && checked.height >= 240)
  assert.equal(record.meta.sources.length, actualDocs.length + 3)
  manuals += actualDocs.length; salesRows += periods.length
}
assert.equal(manuals, 59)
assert.equal(salesRows, 26)
// 似た型式名でも別基本型式の資料や写真を混ぜない。
const sample = await read('data/catalog/kubota/kt30.json')
const photo = photos.find(p => p.id === catalogId(sample.maker, sample.series))
const wrongDoc = structuredClone(sample)
wrongDoc.sources.relatedManuals[0].title = 'KT300Q'
assert.throws(() => buildOverview(wrongDoc, photo), /基本型式/)
assert.throws(() => buildOverview(sample, { ...photo, model: 'KT300' }), /写真/)
assert.throws(() => buildOverview({ ...sample, photoModel: 'KT300' }, { ...photo, labelModel: 'KT300' }), /写真/)
const kt280 = await read('data/catalog/kubota/kt280.json')
assert.equal(kt280.photoModel, 'KT280F')
assert.equal(kt280.sources.salesIndex.result.model, 'KT280(F)')
const result = { checkedAt: manifest.checkedAt, basicModels: 15, catalogCards: 15, additions: 11, existingCardsUpdated: 4, officialManuals: manuals, officialSalesRows: salesRows, photographedCards: 15, duplicateImages: 0, omittedBasicModels: [], omittedOfficialDocuments: [], similarModelIsolation: true }
await writeFile(new URL('coverage-check.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
