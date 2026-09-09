import test from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_FILTERS, paramsFromList, listFromParams } from '../src/search.js'

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
