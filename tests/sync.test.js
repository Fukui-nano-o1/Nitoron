import test from 'node:test'
import assert from 'node:assert/strict'
import { drainOutbox } from '../src/sync.js'

test('保存処理中の編集は新しい版として必ずもう一度送信する', async () => {
  const state = { records: [{ id: 'a', title: 'before' }], pending: { a: 'v1' } }, written = []
  await drainOutbox(state, { isCurrent: () => true, onSaved() {}, write: async r => {
    written.push(r.title)
    if (written.length === 1) { state.records = [{ id: 'a', title: 'after' }]; state.pending.a = 'v2' }
  } })
  assert.deepEqual(written, ['before', 'after']); assert.deepEqual(state.pending, {})
})
test('通信失敗時に未送信の編集を消さず、再試行で保存する', async () => {
  const state = { records: [{ id: 'a' }], pending: { a: 'v1' } }
  await assert.rejects(drainOutbox(state, { isCurrent: () => true, onSaved() {}, write: async () => { throw new Error('offline') } }))
  assert.equal(state.pending.a, 'v1')
  await drainOutbox(state, { isCurrent: () => true, onSaved() {}, write: async () => {} })
  assert.deepEqual(state.pending, {})
})
test('アカウント切り替え後に前のアカウントの送信を続けない', async () => {
  let current = true, count = 0
  const state = { records: [{ id: 'a' }, { id: 'b' }], pending: { a: 'v1', b: 'v1' } }
  const result = await drainOutbox(state, { isCurrent: () => current, onSaved() {}, write: async () => { count++; current = false } })
  assert.equal(result, false); assert.equal(count, 1); assert.equal(state.pending.b, 'v1')
})
