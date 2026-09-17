import test from 'node:test'
import assert from 'node:assert/strict'
import { isDiscoveryHome } from '../src/discovery-domain.js'
import { listFromParams } from '../src/search.js'

test('unfiltered entry uses browse rows', () => {
  assert.equal(isDiscoveryHome(listFromParams('')), true)
})
test('category, query, date and metric deep links remain searchable results', () => {
  for (const params of ['q=KL25', 'region=徳島', 'kind=machine&crop=トラクタ', 'from=2026-01-01', 'numbers=1']) {
    assert.equal(isDiscoveryHome(listFromParams(params)), false, params)
  }
})
test('page and sort deep links never become the browse landing page', () => {
  assert.equal(isDiscoveryHome(listFromParams('page=2')), false)
  assert.equal(isDiscoveryHome(listFromParams('sort=title')), false)
})
