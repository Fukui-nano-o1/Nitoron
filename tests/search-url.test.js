import test from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_FILTERS, paramsFromList, listFromParams } from '../src/search.js'

test('検索語・地域・各フィルタ・並び順・ページ番号はURLと往復して一致する', () => {
  const state = {
    query: '育苗 排水', region: '徳島',
    filters: { crop: 'ブロッコリー', kind: 'challenge', stage: '実践中', from: '2026-04-01', to: '2026-09-01', numbers: true },
    sort: 'title', page: 2, exact: true,
  }
  const params = paramsFromList(state)
  assert.deepEqual(listFromParams(params), state)
  // 共有・再読込を想定し、URLSearchParamsのエンコードを経ても同じ条件へ戻る。
  assert.deepEqual(listFromParams(new URLSearchParams(params).toString()), state)
})

test('条件なしはURLに何も書かず、既定値へ復元される', () => {
  const defaults = { query: '', region: '', filters: { ...EMPTY_FILTERS }, sort: 'recent', page: 0, exact: false }
  assert.equal(paramsFromList(defaults), '')
  assert.deepEqual(listFromParams(''), defaults)
  assert.deepEqual(listFromParams(undefined), defaults)
})

test('URLの不正な値は既定値に丸め、画面を壊さない', () => {
  assert.deepEqual(listFromParams('kind=evil&stage=偽の進捗&from=junk&to=2026-13&page=-3&sort=hack&numbers=2'),
    { query: '', region: '', filters: { ...EMPTY_FILTERS }, sort: 'recent', page: 0, exact: false })
  assert.equal(listFromParams('page=abc').page, 0)
  assert.equal(listFromParams('page=1').page, 0)
  assert.equal(listFromParams(`q=${'あ'.repeat(300)}`).query.length, 160)
})

test('並び順の既定：検索語があれば関連度、なければ新しい順。既定はURLに書かない', () => {
  assert.equal(paramsFromList({ query: '育苗', sort: 'relevance' }), 'q=%E8%82%B2%E8%8B%97')
  assert.equal(paramsFromList({ query: '育苗', sort: 'recent' }), 'q=%E8%82%B2%E8%8B%97&sort=recent')
  assert.equal(listFromParams('q=育苗').sort, 'relevance')
  assert.equal(listFromParams('q=育苗&sort=recent').sort, 'recent')
  // 語なしの関連度順は意味を持たないので新しい順に丸める（URLにも書かない）
  assert.equal(paramsFromList({ query: '', sort: 'relevance' }), '')
  assert.equal(listFromParams('sort=relevance').sort, 'recent')
  assert.equal(listFromParams('exact=1').exact, false, '語なしの exact は無視')
})
