import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { buildOverview, catalogId } from '../../scripts/catalog-overview.mjs'
const root = new URL('../../', import.meta.url)
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const manifest = await read('experiments/kubota-kl-series/source-checks.json')
const pages = await read('experiments/kubota-kl-series/index-pages.json')
const related = await read('experiments/kubota-kl-series/related-documents.json')
const photos = (await read('data/card-photos.json')).entries
const evidence = await read('experiments/kubota-kl-series/photo-checks.json')
const manualPages = pages.filter(p => p.kind === 'manual')
const manualRows = manualPages.flatMap(p => p.rows)
const tractorRows = manualRows.filter(row => row.category === 'トラクタ')
const indexedModels = [...new Set(pages.filter(p => p.kind === 'sales').flatMap(p => p.rows).filter(r => /^(1999|2000)年$/.test(r.startYear) && /^KL\d+H?$/.test(r['spec-id'])).map(r => r['spec-id']))].sort()
const associatedModels = { 'KL25-PC': 'KL25', 'KL33-PC': 'KL33', 'KL41-PC': 'KL41H', 'KL50-PC': 'KL50H' }
const selectedRows = tractorRows.filter(r => indexedModels.includes(r['spec-id']) || associatedModels[r['spec-id']])
assert.equal(manualPages.length, 9)
assert.equal(manualRows.length, 204)
assert.equal(tractorRows.length, 160)
assert.equal(indexedModels.length, 15)
assert.deepEqual(manifest.entries.map(x => x.model).sort(), indexedModels)
const catalogModels = (await readdir(new URL('data/catalog/kubota/', root))).filter(f => /^kl\d+H?\.json$/i.test(f)).map(f => f.replace('.json', '').toUpperCase()).sort()
assert.deepEqual(catalogModels, indexedModels)
assert.deepEqual(related.documents.map(d => [d.title, d.noticeUrl]).sort(), selectedRows.map(r => [r['spec-id'], r.manualUrl]).sort())
assert.equal(related.salesRows.length, 19)
assert.equal(evidence.entries.length, 15)
assert.equal(new Set(evidence.entries.map(p => p.imageSha256)).size, 15)
assert.equal(related.excludedManualRows.length + related.documents.length, manualRows.length)
assert.equal(related.excludedSalesRows.length + related.salesRows.length, pages.filter(p => p.kind === 'sales').flatMap(p => p.rows).length)
let manuals = 0, salesRows = 0
for (const item of manifest.entries) {
  const entry = await read(item.path)
  assert.equal(entry.sources.manualIndex.result.horsepower, item.horsepower)
  assert.deepEqual(entry.sources.salesIndex.result, item.salesResult)
  const photo = photos.find(p => p.id === catalogId(entry.maker, entry.series))
  const record = (await read(item.path.replace(/\.json$/, '.record.json'))).records[0]
  assert.deepEqual(record, buildOverview(entry, photo))
  const expectedDocs = related.documents.filter(d => d.baseModel === item.model)
  const actualDocs = [...entry.sources.manuals, ...entry.sources.relatedManuals, ...(entry.sources.siblingModels || [])]
  assert.deepEqual(actualDocs.map(d => [d.title, d.url]).sort(), expectedDocs.map(d => [d.title, d.noticeUrl]).sort())
  assert.deepEqual(actualDocs.map(d => [item.model, d.title, d.kind || 'base', d.url, d.sha256]).sort(), expectedDocs.map(d => [d.baseModel, d.title, d.docKind, d.noticeUrl, d.noticeCheck.sha256]).sort())
  assert(expectedDocs.every(d => d.noticeCheck.status === 200))
  for (const document of [...entry.sources.relatedManuals, ...(entry.sources.siblingModels || [])]) assert.equal(document.horsepower, `${expectedDocs.find(d => d.title === document.title).horsepower}馬力`)
  for (const document of actualDocs) assert(record.meta.sources.some(s => s.url === document.url))
  const periods = [entry.sources.salesIndex.result, ...(entry.sources.salesIndex.variants || []), ...(entry.sources.siblingModels || []).map(s => s.sales.result)]
  assert.deepEqual(periods.map(p => [p.model, p.startYear, p.endYear]).sort(), related.salesRows.filter(p => p.baseModel === item.model).map(p => [p.model, p.startYear, p.endYear]).sort())
  const checked = evidence.entries.find(p => p.model === item.model)
  assert.equal(photo.url, checked.imageUrl)
  assert.equal(photo.source.url, checked.sourceUrl)
  if (new URL(photo.url).hostname !== new URL(photo.source.url).hostname) {
    assert.equal(photo.imageHost, new URL(checked.imageUrl).hostname)
    assert.deepEqual(photo.sourceImageReference, checked.sourceImageReference)
    assert.equal(photo.sourceImageReference.url, checked.imageUrl)
    assert.equal(photo.sourceImageReference.pageUrl, checked.sourceUrl)
    assert.equal(photo.sourceImageReference.pageSha256, checked.sourceSha256)
    assert.equal(photo.sourceImageReference.verifiedInPage, true)
    assert.throws(() => buildOverview(entry, { ...photo, imageHost: undefined }), /写真/)
  }
  assert.equal(checked.imageStatus, 200)
  assert.equal(checked.sourceStatus, 200)
  assert(checked.width >= 240 && checked.height >= 240)
  assert.equal(record.meta.sources.length, actualDocs.length + 3 + (entry.sources.siblingModels?.length || 0))
  manuals += actualDocs.length; salesRows += periods.length
}
assert.equal(manuals, 19)
assert.equal(salesRows, 19)
// 初期KLと後継世代・別型式の写真を取り違えない。
const sample = await read('data/catalog/kubota/kl25.json')
const photo = photos.find(p => p.id === catalogId(sample.maker, sample.series))
for (const title of ['KL250', 'KL255']) {
  const wrongDoc = structuredClone(sample)
  wrongDoc.sources.relatedManuals[0].title = title
  assert.throws(() => buildOverview(wrongDoc, photo), /基本型式/)
}
assert.throws(() => buildOverview(sample, { ...photo, model: 'KL250' }), /写真/)
assert.throws(() => buildOverview({ ...sample, photoModel: 'KL250' }, { ...photo, labelModel: 'KL250' }), /写真/)
const siblingCard = await read('data/catalog/kubota/kl41h.json')
assert.equal(siblingCard.sources.manualIndex.result.horsepower, '41馬力')
assert.equal(siblingCard.sources.siblingModels[0].title, 'KL41-PC')
assert.equal(siblingCard.sources.siblingModels[0].horsepower, '42馬力')
const siblingPhoto = photos.find(p => p.id === catalogId(siblingCard.maker, siblingCard.series))
assert.throws(() => buildOverview({ ...siblingCard, photoModel: 'KL41-PC' }, { ...siblingPhoto, labelModel: 'KL41-PC' }), /写真/)
const result = { checkedAt: manifest.checkedAt, scope: 'KL models first sold in 1999–2000', basicModels: 15, catalogCards: 15, additions: 7, existingCardsUpdated: 8, officialManuals: manuals, officialSalesRows: salesRows, photographedCards: 15, duplicateImages: 0, omittedBasicModels: [], omittedSelectedDocuments: [], successorGenerationsIncluded: false }
await writeFile(new URL('coverage-check.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
