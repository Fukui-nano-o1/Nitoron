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

test('型式の語はハイフンの有無を問わず当たり、記録内検索は当たった節と行だけを返す', async () => {
  const { termVariants, matches } = await import('../src/domain.js')
  const { groupSection, searchSections, highlightParts } = await import('../src/catalog-domain.js')
  assert.deepEqual(termVariants('tms300'), ['tms300', 'tms-300']); assert.deepEqual(termVariants('ta-701n'), ['ta-701n', 'ta701n']); assert.deepEqual(termVariants('オイル'), ['オイル'])
  const blocks = [
    { id: 'a', type: 'callout', text: '前書き' }, { id: 'b', type: 'h2', text: 'エンジン' }, { id: 'c', type: 'bullet', text: 'エンジンオイル：0.4 L（印刷p.43）' }, { id: 'd', type: 'bullet', text: '点火プラグ：NGK BPR6HS' },
    { id: 'e', type: 'h2', text: '症状から探す' }, { id: 'f', type: 'h3', text: 'エンジンが始動しない' }, { id: 'g', type: 'bullet', text: '燃料コックの位置' }, { id: 'h', type: 'bullet', text: 'プラグの汚れ' }, { id: 'i', type: 'h3', text: '旋回しない' }, { id: 'j', type: 'bullet', text: '操向クラッチケーブルの調節' },
  ]
  const record = { title: '【カタログ解説】クボタ TMS-300', category: '', type: '', blocks, meta: { kind: 'trouble', subject: 'normal' } }
  assert.equal(matches(record, 'TMS300'), true); assert.equal(matches(record, 'tms-300 オイル'), true); assert.equal(matches(record, 'trs300'), false)
  assert.deepEqual(groupSection(blocks.slice(5, 10)).map(g => [g.head?.id || null, g.rows.map(b => b.id)]), [['f', ['g', 'h']], ['i', ['j']]])
  assert.equal(searchSections(blocks, ''), null); assert.equal(searchSections(blocks, '  '), null)
  const oil = searchSections(blocks, 'ｵｲﾙ')
  assert.deepEqual(oil.map(s => [s.id, s.total, s.groups.map(g => [g.head?.id || null, g.rows.map(b => b.id)])]), [['sec-b', 1, [[null, ['c']]]]])
  // h3 が当たれば組ごと、行だけが当たれば h3 を添えてその行だけ
  assert.deepEqual(searchSections(blocks, '始動').map(s => [s.id, s.total, s.groups.map(g => [g.head?.id, g.rows.map(b => b.id)])]), [['sec-e', 3, [['f', ['g', 'h']]]]])
  assert.deepEqual(searchSections(blocks, 'プラグ').map(s => [s.id, s.total, s.groups.map(g => [g.head?.id || null, g.rows.map(b => b.id)])]), [['sec-b', 1, [[null, ['d']]]], ['sec-e', 1, [['f', ['h']]]]])
  assert.deepEqual(searchSections(blocks, '存在しない語'), [])
  assert.deepEqual(highlightParts('点火プラグ：NGK BPR6HS', 'プラグ ngk'), [{ text: '点火', mark: false }, { text: 'プラグ', mark: true }, { text: '：', mark: false }, { text: 'NGK', mark: true }, { text: ' BPR6HS', mark: false }])
  assert.deepEqual(highlightParts('a', ''), [{ text: 'a', mark: false }])
})
