import test from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_FILTERS, MACHINE_KIND, CHIPS, activeChip, discoverHref, filterRecord, paramsFromList, listFromParams } from '../src/search.js'

test('検索語・地域・各フィルタ・並び順・ページ番号はURLと往復して一致する', () => {
  const state = {
    query: '育苗 排水', region: '徳島',
    filters: { crop: 'ブロッコリー', kind: 'challenge', stage: '実践中', from: '2026-04-01', to: '2026-09-01', numbers: true },
    sort: 'title', page: 2,
  }
  const params = paramsFromList(state)
  assert.deepEqual(listFromParams(params), state)
  // 共有・再読込を想定し、URLSearchParamsのエンコードを経ても同じ条件へ戻る。
  assert.deepEqual(listFromParams(new URLSearchParams(params).toString()), state)
})

test('条件なしはURLに何も書かず、既定値へ復元される', () => {
  const defaults = { query: '', region: '', filters: { ...EMPTY_FILTERS }, sort: 'recent', page: 0 }
  assert.equal(paramsFromList(defaults), '')
  assert.deepEqual(listFromParams(''), defaults)
  assert.deepEqual(listFromParams(undefined), defaults)
})

test('URLの不正な値は既定値に丸め、画面を壊さない', () => {
  assert.deepEqual(listFromParams('kind=evil&stage=偽の進捗&from=junk&to=2026-13&page=-3&sort=hack&numbers=2'),
    { query: '', region: '', filters: { ...EMPTY_FILTERS }, sort: 'recent', page: 0 })
  assert.equal(listFromParams('page=abc').page, 0)
  assert.equal(listFromParams('page=1').page, 0)
  assert.equal(listFromParams(`q=${'あ'.repeat(300)}`).query.length, 160)
})

test('機械の仮想分類 kind=machine はURLと往復し、各チップの条件も同じ kind／crop に戻る', () => {
  const state = { query: '', region: '', filters: { ...EMPTY_FILTERS, kind: MACHINE_KIND, crop: 'トラクタ' }, sort: 'recent', page: 0 }
  assert.deepEqual(listFromParams(paramsFromList(state)), state)
  for (const [, chip] of CHIPS) {
    const filters = { ...EMPTY_FILTERS, kind: chip.kind, crop: chip.crop }
    const back = listFromParams(paramsFromList({ filters })).filters
    assert.equal(back.kind, chip.kind)
    assert.equal(back.crop, chip.crop)
    assert.equal(activeChip(back)?.[1], chip)
  }
  assert.equal(activeChip({ ...EMPTY_FILTERS }), null)
  assert.equal(activeChip({ ...EMPTY_FILTERS, kind: 'trouble' }), null)
})

test('discoverHref は #/discover?… を返し、条件なしは #/discover になる', () => {
  assert.equal(discoverHref({ query: '', region: '', filters: EMPTY_FILTERS, sort: 'recent', page: 0 }), '#/discover')
  const href = discoverHref({ query: 'SKP', region: '徳島', filters: { ...EMPTY_FILTERS, kind: MACHINE_KIND, crop: '野菜' }, page: 1 })
  assert.match(href, /^#\/discover\?/)
  assert.deepEqual(listFromParams(href.slice('#/discover?'.length)), { query: 'SKP', region: '徳島', filters: { ...EMPTY_FILTERS, kind: MACHINE_KIND, crop: '野菜' }, sort: 'recent', page: 1 })
})

test('filterRecord の machine 判定は learning・trouble を通し presentation を落とす', () => {
  const record = kind => ({ title: 'TMS-200', date: '2026-09-14', blocks: [], meta: { kind, crop: 'ミニ耕うん機', region: '', observations: [] } })
  const filters = { ...EMPTY_FILTERS, kind: MACHINE_KIND }
  assert.equal(filterRecord(record('learning'), { filters }), true)
  assert.equal(filterRecord(record('trouble'), { filters }), true)
  assert.equal(filterRecord(record('presentation'), { filters }), false)
  assert.equal(filterRecord(record('trouble'), { filters: { ...filters, crop: '耕うん機' } }), true)
  assert.equal(filterRecord(record('trouble'), { filters: { ...filters, crop: 'トラクタ' } }), false)
  assert.equal(filterRecord(record('learning'), { filters: { ...EMPTY_FILTERS, kind: 'learning' } }), true)
  assert.equal(filterRecord(record('learning'), { filters: { ...EMPTY_FILTERS, kind: 'trouble' } }), false)
})
