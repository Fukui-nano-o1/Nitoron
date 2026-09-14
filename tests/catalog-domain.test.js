import test from 'node:test'
import assert from 'node:assert/strict'
import { isCatalogRecord, parseCatalogTitle, seriesOf, relatedRows, sectionsOf } from '../src/catalog-domain.js'

test('カタログ解説の題名からメーカー・型式・シリーズ・分類を読む', () => {
  assert.deepEqual(parseCatalogTitle('【カタログ解説】クボタ TMS-200 Midy Smile-mini（ミニ耕うん機）'), { maker: 'クボタ', model: 'TMS-200', series: 'TMS', name: 'Midy Smile-mini', category: 'ミニ耕うん機' })
  assert.deepEqual(parseCatalogTitle('【カタログ解説】クボタ KP-103'), { maker: 'クボタ', model: 'KP-103', series: 'KP', name: '', category: '' })
  assert.equal(parseCatalogTitle('クボタ TMS-200'), null)
  assert.equal(seriesOf('SKP-101W'), 'SKP'); assert.equal(seriesOf('200'), ''); assert.equal(seriesOf(''), '')
  assert.equal(isCatalogRecord({ title: '【カタログ解説】クボタ TMS-200', meta: { kind: 'trouble', subject: 'normal' } }), true)
  assert.equal(isCatalogRecord({ title: 'クボタ SKP-101W', meta: { kind: 'trouble', subject: 'machine_repair' } }), false)
  assert.equal(isCatalogRecord({ title: '【カタログ解説】x', meta: { kind: 'learning' } }), false)
})

test('関連行はシリーズ→メーカーの順で、検索語は全文検索で当たる形', () => {
  const rows = relatedRows({ title: '【カタログ解説】クボタ TMS-200 Midy Smile-mini（ミニ耕うん機）' })
  assert.deepEqual(rows.map(r => r.key), ['series', 'maker'])
  assert.equal(rows[0].query, 'カタログ解説 クボタ TMS-'); assert.equal(rows[1].query, 'カタログ解説 クボタ')
  assert.deepEqual(relatedRows({ title: '経営発表' }), [])
  assert.deepEqual(relatedRows({ title: '【カタログ解説】クボタ 200' }).map(r => r.key), ['maker'])
})

test('本文の h2 が節になり、id は見出しブロックから決まる', () => {
  const blocks = [{ id: 'a', type: 'text', text: '前書き' }, { id: 'b', type: 'h2', text: '部品の名称' }, { id: 'c', type: 'bullet', text: 'x' }, { id: 'd', type: 'h2', text: ' ' }, { id: 'e', type: 'h2', text: '操作方法' }]
  assert.deepEqual(sectionsOf(blocks), [{ id: 'sec-b', title: '部品の名称' }, { id: 'sec-e', title: '操作方法' }])
  assert.deepEqual(sectionsOf(undefined), [])
})
