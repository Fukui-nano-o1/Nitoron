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

test('頁の引用は取扱説明書の頁ページへ結び、引いた頁の一覧と「この頁を引く行」が出る', async () => {
  const { manualOffset, citeParts, citedPages, sectionsCitingPage, manualSource, manualPageHref } = await import('../src/catalog-domain.js')
  const blocks = [
    { id: 'a', type: 'callout', text: '本文の印刷頁 = PDF頁 − 6。' }, { id: 'b', type: 'h2', text: 'エンジン' },
    { id: 'c', type: 'bullet', text: 'エンジンオイル：0.4 L（印刷p.43／PDF 49） — やり方は印刷p.46。' }, { id: 'd', type: 'bullet', text: '点火プラグ：NGK（印刷p.50／PDF 56）' },
    { id: 'e', type: 'h2', text: '安全' }, { id: 'f', type: 'bullet', text: '服装：印刷p.5（印刷p.5／PDF 11）' }, { id: 'g', type: 'bullet', text: '安全の章は印刷p.5〜14。' },
  ]
  assert.equal(manualOffset(blocks), 6); assert.equal(manualOffset([]), null)
  assert.deepEqual(citeParts('油 0.4 L（印刷p.43／PDF 49） — やり方は印刷p.46。', 6), [{ text: '油 0.4 L' }, { text: '（印刷p.43／PDF 49）', printed: 43, pdf: 49 }, { text: ' — やり方は' }, { text: '印刷p.46', printed: 46, pdf: 52 }, { text: '。' }])
  assert.deepEqual(citeParts('やり方は印刷p.46。', null), [{ text: 'やり方は' }, { text: '印刷p.46', printed: 46, pdf: null }, { text: '。' }])
  assert.deepEqual(citeParts('引用なし', 6), [{ text: '引用なし' }]); assert.deepEqual(citeParts('', 6), [{ text: '' }])
  assert.deepEqual(citedPages(blocks), [{ printed: 5, pdf: 11, count: 2 }, { printed: 43, pdf: 49, count: 1 }, { printed: 46, pdf: 52, count: 1 }, { printed: 50, pdf: 56, count: 1 }])
  assert.deepEqual(sectionsCitingPage(blocks, 5).map(s => [s.id, s.groups[0].rows.map(b => b.id)]), [['sec-e', ['f', 'g']]])
  assert.deepEqual(sectionsCitingPage(blocks, 46).map(s => [s.id, s.groups[0].rows.map(b => b.id)]), [['sec-b', ['c']]])
  assert.deepEqual(sectionsCitingPage(blocks, 99), [])
  const record = { meta: { sources: [{ title: '製品ページ', url: 'https://example.com/p' }, { title: '取扱説明書 KA071', url: 'https://agriculture.kubota.co.jp/after-support/manual/notice.html?hash=abc' }] } }
  assert.deepEqual(manualSource(record), { title: '取扱説明書 KA071', url: 'https://agriculture.kubota.co.jp/after-support/manual/notice.html?hash=abc' })
  assert.equal(manualSource({ meta: { sources: [] } }), null)
  assert.equal(manualPageHref('id1', 62), '#/public/id1/manual/62')
})

test('詳細ページの構成：症状→整備の周期→部品と費用→諸元→名称…の順。表は本文の行から作る', async () => {
  const { catalogSections, catalogNav, scheduleRows, specRow, partRows, sameModel, repairRecordsFor, recordedCosts, costsForPart } = await import('../src/catalog-domain.js')
  const blocks = [
    { id: 'i', type: 'text', text: '販売型式名 TMS400。出典：取扱説明書 LK231-6512-3（PDF 59頁）。' },
    { id: 'h1', type: 'h2', text: '部品の名称' }, { id: 'n1', type: 'bullet', text: '主クラッチレバー' },
    { id: 'h2', type: 'h2', text: 'エンジン' }, { id: 'e0', type: 'text', text: 'GB131 の空冷4サイクル。' }, { id: 'e1', type: 'bullet', text: 'エンジン型式：GB131（印刷p.50／PDF 54）' }, { id: 'e2', type: 'bullet', text: '燃料タンク容量：2.6 L（印刷p.50／PDF 54）' },
    { id: 'h3', type: 'h2', text: '整備と点検（索引）' }, { id: 'm0', type: 'text', text: '一覧表が軸。' }, { id: 'm1', type: 'bullet', text: '定期点検箇所一覧表：主クラッチケーブル（初期5時間後）／エンジンオイル（初回20時間、以後50時間ごと）／点火プラグ（6か月に1回）（印刷p.39／PDF 43）' }, { id: 'm2', type: 'bullet', text: '給油一覧表：燃料2.6 L／エンジン0.5 L（印刷p.40／PDF 44）' }, { id: 'm3', type: 'bullet', text: '主クラッチケーブルの調節：印刷p.45（印刷p.45／PDF 49）' }, { id: 'm4', type: 'bullet', text: '主な消耗部品（本機）：Vベルト SB-37（LK161-62210）、スパークプラグ LE010-11970（FTR70）／LE010-12830（FTR90）（印刷p.51／PDF 55）' },
    { id: 'h4', type: 'h2', text: '症状から探す（取扱説明書の索引）' }, { id: 's1', type: 'h3', text: 'エンジンが始動しないとき（印刷p.53／PDF 57）' }, { id: 's1a', type: 'bullet', text: '燃料の劣化（印刷p.53／PDF 57）' }, { id: 's2', type: 'h3', text: 'ハンドルのガタが多い（印刷p.53／PDF 57）' }, { id: 's2a', type: 'bullet', text: 'ノブの締め直し（印刷p.53／PDF 57）' },
    { id: 'h5', type: 'h2', text: '未確認' }, { id: 'u1', type: 'bullet', text: '価格' },
  ]
  const secs = catalogSections(blocks)
  assert.deepEqual(secs.map(s => s.kind), ['lead', 'diagnosis', 'schedule', 'parts', 'specs', 'list', 'list'])
  assert.deepEqual(catalogNav(blocks).map(s => [s.id, s.title]), [['sec-h4', '症状から診断する'], ['sec-h3', '整備の周期'], ['sec-parts', '部品と費用'], ['sec-h2', 'エンジン'], ['sec-h1', '部品の名称'], ['sec-h5', '未確認']])
  const diag = secs[1]; assert.equal(diag.groups.length, 2); assert.equal(diag.groups[0].head.id, 's1'); assert.deepEqual(diag.groups[1].rows.map(b => b.id), ['s2a'])
  const sched = secs[2]
  assert.deepEqual(sched.rows, [{ item: '主クラッチケーブル', interval: '初期5時間後' }, { item: 'エンジンオイル', interval: '初回20時間、以後50時間ごと' }, { item: '点火プラグ', interval: '6か月に1回' }])
  assert.equal(sched.oil.id, 'm2'); assert.deepEqual(sched.rest.map(b => b.id), ['m3', 'm4'])
  assert.deepEqual(scheduleRows('点検・給油・調節一覧表：エンジンオイル0.4 L（初期20時間）／チェンケース各0.5 L（印刷p.83／PDF 91）'), [{ item: 'エンジンオイル0.4 L', interval: '初期20時間' }, { item: 'チェンケース各0.5 L', interval: '' }])
  // 部品：資料番号（取扱説明書 LK231-6512-3）は拾わない。名前が省かれた続きの品番は直前の名前を引き継ぐ。
  const parts = secs[3]
  assert.deepEqual(parts.rows.map(r => [r.name, r.partNumber, r.note]), [['Vベルト SB-37', 'LK161-62210', ''], ['スパークプラグ', 'LE010-11970', 'FTR70'], ['スパークプラグ', 'LE010-12830', 'FTR90']])
  assert.deepEqual(parts.consumables.map(b => b.id), ['m4'])
  assert.deepEqual(partRows([{ id: 'x', type: 'text', text: '取扱説明書 LK231-6512-3' }]), [])
  // 諸元：「項目：値」の表。前書きは intro。
  const specs = secs[4]; assert.deepEqual(specs.rows.map(r => [r.label, r.value]), [['エンジン型式', 'GB131'], ['燃料タンク容量', '2.6 L']]); assert.equal(specs.intro.id, 'e0')
  assert.deepEqual(specRow('最大出力：3.0 kW｛4.2 PS｝（印刷p.50／PDF 54）'), { label: '最大出力', value: '3.0 kW｛4.2 PS｝' }); assert.equal(specRow('見出しだけ'), null)
  // 費用：同じ型式（ハイフンの有無・仕様記号を問わない）の修理記録の「行ったこと」から、費用のある行だけ。部品名か品番が一致すれば表の行に付く。
  assert.equal(sameModel('TMS-400', 'tms400'), true); assert.equal(sameModel('TMS-400', 'TMS-400U'), true); assert.equal(sameModel('TMS-400', 'TMS-200'), false); assert.equal(sameModel('', 'TMS-400'), false)
  const repairs = [
    { id: 'r1', title: 'ベルト', date: '2026-01-01', meta: { subject: 'machine_repair', repair: { machine: { model: 'TMS400' }, actions: [{ date: '2026-02-01', what: 'ベルト交換', parts: 'Vベルト SB-37', cost: '3,200' }, { what: '清掃', cost: '' }] } } },
    { id: 'r2', title: '他機', meta: { subject: 'machine_repair', repair: { machine: { model: 'TRS-300' }, actions: [{ cost: '500' }] } } },
    { id: 'r3', title: 'カタログ', meta: { subject: 'normal', kind: 'trouble' } },
  ]
  const mine = repairRecordsFor('TMS-400', repairs); assert.deepEqual(mine.map(r => r.id), ['r1'])
  const costs = recordedCosts(mine); assert.deepEqual(costs, [{ recordId: 'r1', title: 'ベルト', date: '2026-02-01', what: 'ベルト交換', parts: 'Vベルト SB-37', cost: 3200 }])
  assert.equal(costsForPart(costs, parts.rows[0]).length, 1); assert.equal(costsForPart(costs, parts.rows[1]).length, 0)
  assert.deepEqual(catalogSections([]), []); assert.deepEqual(catalogNav(undefined), [])
})
