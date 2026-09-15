import test from 'node:test'
import assert from 'node:assert/strict'
import { PRIVATE_USER_ID, isPrivateEmail, isPrivateUser, sendPrivateLogin, verifyPrivateLogin, watchPrivateAccess } from '../src/private-access.mjs'

const owner = { id: PRIVATE_USER_ID, email: 't5fki6643qty@gmail.com', is_anonymous: false, email_confirmed_at: '2026-09-15T00:00:00Z' }
const ownerSession = { access_token: 'fixture-token', user: owner }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const settle = () => new Promise(resolve => setImmediate(resolve))
async function waitFor(condition) {
  const until = Date.now() + 3000
  while (!condition()) {
    if (Date.now() >= until) assert.fail('expected Auth state was not observed within 3 seconds')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}
function harness({ session = ownerSession, user = owner, verification } = {}) {
  let listener, unsubscribed = false
  const calls = [], changes = []
  const auth = {
    getSession: async () => ({ data: { session } }),
    getUser: async token => { calls.push(token); return verification ? verification.promise : { data: { user } } },
    onAuthStateChange: fn => { listener = fn; return { data: { subscription: { unsubscribe() { unsubscribed = true } } } } },
  }
  const stop = watchPrivateAccess(auth, state => changes.push(state))
  return { calls, changes, stop, emit: (event, session) => listener(event, session), get unsubscribed() { return unsubscribed } }
}

test('許可はID・正規化メール・確認済み実アカウントの全条件が一致する場合だけ', () => {
  assert.equal(isPrivateEmail(' T5FKI6643QTY@GMAIL.COM '), true)
  assert.equal(isPrivateUser(owner), true)
  for (const value of [null, {}, { ...owner, id: 'other' }, { ...owner, email: 'other@example.test' }, { ...owner, is_anonymous: true }, { ...owner, email_confirmed_at: null }]) assert.equal(isPrivateUser(value), false)
})

test('送信と再送は許可先のみ・新規登録禁止、コード確認も別メールを呼び出さない', async () => {
  const sent = [], verified = []
  const auth = { signInWithOtp: async input => { sent.push(input); return {} }, verifyOtp: async input => { verified.push(input); return {} } }
  for (const email of ['other@example.test', '', owner.email + '.invalid']) {
    await assert.rejects(sendPrivateLogin(auth, email, 'https://example.test/#/public/one'))
    await assert.rejects(verifyPrivateLogin(auth, email, '123456'))
  }
  assert.equal(sent.length, 0); assert.equal(verified.length, 0)
  for (let i = 0; i < 2; i++) await sendPrivateLogin(auth, ' T5FKI6643QTY@GMAIL.COM ', 'https://example.test/#/public/one')
  assert.deepEqual(sent, Array(2).fill({ email: owner.email, options: { shouldCreateUser: false, emailRedirectTo: 'https://example.test/#/public/one' } }))
  await verifyPrivateLogin(auth, owner.email, ' 123456 ')
  assert.deepEqual(verified, [{ email: owner.email, token: '123456', type: 'email' }])
})

test('キャッシュが本人を名乗ってもgetUser完了前には一度も開かない', async () => {
  const verification = deferred(), h = harness({ verification })
  await waitFor(() => h.calls.length === 1)
  assert.deepEqual(h.calls, ['fixture-token'])
  assert.equal(h.changes.some(x => x.status === 'allowed'), false)
  const serverUser = { ...owner, user_metadata: { verified_source: 'server' } }
  verification.resolve({ data: { user: serverUser } })
  await waitFor(() => h.changes.at(-1)?.status === 'allowed')
  assert.deepEqual(h.changes.at(-1), { status: 'allowed', session: { ...ownerSession, user: serverUser } })
  h.stop()
})

test('サーバが別ユーザー・匿名・失効を返した場合は偽のキャッシュを拒否する', async () => {
  for (const user of [{ ...owner, id: 'other' }, { ...owner, email: 'other@example.test' }, { ...owner, is_anonymous: true }, null]) {
    const h = harness({ user }); await waitFor(() => h.changes.at(-1)?.status === 'login')
    assert.equal(h.changes.at(-1).status, 'login')
    assert.equal(h.changes.some(x => x.status === 'allowed'), false)
    h.stop()
  }
})

test('ログアウトは即閉じ、遅れて完了したgetUserから再び開かない', async () => {
  const verification = deferred(), h = harness({ verification })
  await waitFor(() => h.calls.length === 1)
  h.emit('SIGNED_OUT', null)
  assert.deepEqual(h.changes.at(-1), { status: 'login', session: null })
  verification.resolve({ data: { user: owner } }); await settle()
  assert.equal(h.changes.some(x => x.status === 'allowed'), false)
  h.stop()
})

test('同一ユーザーの更新中は直前の検証済みsessionだけ保持し、新tokenはサーバ確認後に渡す', async () => {
  const h = harness(); await waitFor(() => h.changes.at(-1)?.status === 'allowed')
  assert.equal(h.changes.at(-1).status, 'allowed')
  h.emit('TOKEN_REFRESHED', { ...ownerSession, access_token: 'next-token' })
  assert.deepEqual(h.changes.at(-1), { status: 'checking', session: ownerSession })
  await waitFor(() => h.changes.at(-1)?.status === 'allowed')
  assert.equal(h.changes.at(-1).status, 'allowed')
  assert.deepEqual(h.calls, ['fixture-token', 'next-token'])
  h.emit('USER_UPDATED', { ...ownerSession, access_token: 'next-token' })
  assert.equal(h.changes.at(-1).session.access_token, 'next-token')
  h.emit('SIGNED_IN', { ...ownerSession, user: { ...owner, id: 'other' } })
  assert.deepEqual(h.changes.at(-1), { status: 'checking', session: null })
  h.stop()
})

test('未ログイン・設定なし・通信失敗は閉じ、破棄後は古い結果を通知しない', async () => {
  const missing = []
  watchPrivateAccess(null, value => missing.push(value))()
  assert.deepEqual(missing, [{ status: 'unavailable', session: null }])
  const signedOut = harness({ session: null }); await waitFor(() => signedOut.changes.at(-1)?.status === 'login')
  assert.equal(signedOut.changes.at(-1).status, 'login'); assert.equal(signedOut.calls.length, 0); signedOut.stop()
  const failed = deferred(), errorHarness = harness({ verification: failed }); await waitFor(() => errorHarness.calls.length === 1)
  failed.reject(new Error('offline')); await waitFor(() => errorHarness.changes.at(-1)?.status === 'login')
  assert.equal(errorHarness.changes.at(-1).status, 'login'); errorHarness.stop()
  const verification = deferred(), h = harness({ verification }); await waitFor(() => h.calls.length === 1)
  h.stop(); const count = h.changes.length
  verification.resolve({ data: { user: owner } }); await settle()
  assert.equal(h.changes.length, count); assert.equal(h.unsubscribed, true)
})
