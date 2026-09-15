import test from 'node:test'
import assert from 'node:assert/strict'
import { expandQuery, expandTerm, hasExpansion, suggestFromSynonyms, suggestPrefectures, canonicalOf } from '../src/synonyms.js'
import { matchesExpanded, relevanceScore, rankRecords, snippet, relaxations, datePreset, EMPTY_FILTERS } from '../src/search.js'
import { suggestKeywords, suggestRegions } from '../src/suggest.js'
import { newRecord } from '../src/domain.js'
const rec = ({ title = '', crop = '', summary = '', text = '', fact = '', date = '2026-09-01' }) => {
  const r = newRecord(); r.title = title; r.date = date
  if (text) r.blocks = [{ id: 'b', type: 'text', text }]
  Object.assign(r.meta, { crop, summary, observations: fact ? [{ id: 'o', date, fact, conditions: '', evidence: '' }] : [] })
  return r
}
test('同義語：完全一致した語だけ組に展開し、表記（全角・カナ）を正規化する', () => {
  assert.deepEqual(expandTerm('イネ').alternatives, ['水稲', '稲', 'いね', '米', 'こめ', '稲作'])
  assert.deepEqual(expandTerm('イネ').expanded, ['水稲', '稲', '米', 'コメ', '稲作'])
  assert.deepEqual(expandTerm('育苗ハウス').alternatives, ['育苗はうす'], '部分一致では展開しない')
  assert.deepEqual(expandQuery(' 育苗　ＴＯＭＡＴＯ ').map(t => t.term), ['育苗', 'tomato'])
  assert.deepEqual(expandQuery('育苗', true).map(t => t.alternatives), [['育苗']], 'exact は展開なし')
  assert.equal(hasExpansion('育苗'), true); assert.equal(hasExpansion('発芽率'), false)
  assert.equal(canonicalOf('こめ'), '水稲'); assert.equal(canonicalOf('なし'), null)
})
test('同義語を含めた一致：語ごとに候補のいずれかを含めばよく、語同士は AND', () => {
  const r = rec({ title: '播種の時期', crop: 'ブロッコリー', text: '花蕾が小さい' })
  assert.equal(matchesExpanded(r, '育苗'), true, '播種は育苗の組')
  assert.equal(matchesExpanded(r, '育苗', true), false, 'exact は入力語だけ')
  assert.equal(matchesExpanded(r, '育苗 排水'), false)
  assert.equal(matchesExpanded(r, '苗 ブロッコリ'), true)
})
test('関連度：タイトル > 作物 > 要約 > 本文。同点は元の順を保つ', () => {
  const a = rec({ title: '育苗の工夫', text: 'x' }), b = rec({ crop: '水稲', text: '苗の話' }), c = rec({ summary: '苗を守る' }), d = rec({ text: '播種した' }), e = rec({ text: '無関係' })
  assert.equal(relevanceScore(a, '育苗'), 8)
  assert.equal(relevanceScore(b, '育苗'), 1)
  assert.equal(relevanceScore(c, '育苗'), 2)
  assert.equal(relevanceScore(d, '育苗'), 1)
  assert.equal(relevanceScore(e, '育苗'), 0)
  assert.equal(relevanceScore(rec({ title: '苗', summary: '苗', text: '苗' }), '育苗'), 8, '語ごとに最上位の欄だけ数える（サーバー関数と同じ）')
  assert.equal(relevanceScore(rec({ title: '苗', text: '排水' }), '育苗 排水'), 9, '語ごとに足す')
  assert.deepEqual(rankRecords([e, d, c, b, a], '育苗').map(r => r.title || r.meta.crop || r.meta.summary || r.blocks[0]?.text), ['育苗の工夫', '苗を守る', '播種した', '水稲', '無関係'], '同点（本文一致）は元の順')
  assert.deepEqual(rankRecords([a, b], ''), [a, b], '語なしは並べ替えない')
})
test('抜粋：一致した語の前後を短く返し、一致がなければ null', () => {
  const r = rec({ summary: '要約', text: 'あ'.repeat(60) + '育苗ハウスの温度' + 'い'.repeat(60) })
  const s = snippet(r, '育苗')
  assert.equal(s.match, '育苗'); assert.equal(s.before, '…' + 'あ'.repeat(40)); assert.equal(s.after, 'ハウスの温度' + 'い'.repeat(34) + '…')
  assert.equal(snippet(r, 'トマト'), null)
  assert.equal(snippet(rec({ text: 'コメの記録' }), '米').match, 'コメ', '同義語の一致箇所も抜粋する')
  assert.equal(snippet(rec({ text: 'ＡＢＣ 米' }), '米').match, '米', '全角英字は1対1なので抜粋できる')
  assert.equal(snippet(rec({ text: '㌔ 米' }), '米'), null, '正規化で長さが変わる文は位置が合わないので抜粋しない')
})
test('0件の緩和提案：外せる条件が2つ以上あるときだけ、1つずつ外した案を返す', () => {
  assert.deepEqual(relaxations({ query: '育苗', filters: EMPTY_FILTERS }), [], '条件が1つならクリアと同じなので提案しない')
  const list = relaxations({ query: '育苗 排水', region: '徳島', filters: { ...EMPTY_FILTERS, crop: 'トマト', kind: 'challenge', stage: '実践中', from: '2026-01-01', to: '', numbers: true }, exact: true })
  assert.deepEqual(list.map(x => x.key), ['term:育苗', 'term:排水', 'exact', 'region', 'crop', 'stage', 'dates', 'numbers'])
  assert.deepEqual(list[0].patch, { query: '排水' })
  assert.deepEqual(list[3].patch, { region: '' })
  assert.equal(list[5].patch.filters.stage, 'all'); assert.equal(list[5].patch.filters.kind, 'challenge', '進捗を外しても分類は残す')
})
test('候補：最近の検索・作物・課題・関連する語と都道府県', () => {
  const empty = suggestKeywords('', { recent: ['育苗 徳島'], crops: ['ブロッコリー', 'ブロッコリー', '水稲'] })
  assert.deepEqual(empty.slice(0, 3), [{ kind: 'recent', value: '育苗 徳島' }, { kind: 'crop', value: 'ブロッコリー' }, { kind: 'crop', value: '水稲' }])
  const typed = suggestKeywords('いね', { recent: [], crops: ['水稲'] })
  assert.deepEqual(typed, [{ kind: 'synonym', value: '水稲' }])
  const partial = suggestKeywords('苗', { recent: ['育苗 徳島'], crops: [] })
  assert.deepEqual(partial.map(s => s.value), ['育苗 徳島', '育苗'])
  assert.deepEqual(suggestPrefectures('とく'), ['徳島県'])
  assert.deepEqual(suggestPrefectures('ふく'), ['福島県', '福井県', '福岡県'])
  assert.deepEqual(suggestRegions('とく', { regions: ['徳島県阿波市', '香川'] }).map(s => s.value), ['徳島県'], '漢字の地域名はかな入力では引けない')
  assert.deepEqual(suggestRegions('徳島', { regions: ['徳島県阿波市', '香川'] }).map(s => s.value), ['徳島県', '徳島県阿波市'])
})
test('記録日プリセット：今シーズンは直近の4月1日、1年・3か月は今日基準、終了日は空', () => {
  assert.deepEqual(datePreset('season', new Date(2026, 8, 15)), { from: '2026-04-01', to: '' })
  assert.deepEqual(datePreset('season', new Date(2026, 1, 10)), { from: '2025-04-01', to: '' })
  assert.deepEqual(datePreset('year', new Date(2026, 8, 15)), { from: '2025-09-15', to: '' })
  assert.deepEqual(datePreset('quarter', new Date(2026, 0, 31)), { from: '2025-10-31', to: '' })
  assert.deepEqual(datePreset('none'), { from: '', to: '' })
})
