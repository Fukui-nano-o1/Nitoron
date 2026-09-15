// Run: node experiments/private-access/check-browser.mjs
// Starts/stops a local Vite child process with an intentionally fake Supabase
// origin. All Auth/data requests are mocked; no email is delivered.
// Optional: PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome
// PRIVATE_TEST_EXTERNAL_SERVER=1 uses an already-running fake-config dev server.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { newRecord, publicSnapshot } from '../../src/domain.js'
import { PRIVATE_USER_ID } from '../../src/private-access.mjs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const BASE = process.env.PRIVATE_TEST_URL || 'http://127.0.0.1:4175'
const AUTH_HOST = 'nitoron-private-test.supabase.co'
const KEY = 'sb-nitoron-private-test-auth-token'
const ID = '11111111-2222-4333-8444-555555555555'
const owner = { id: PRIVATE_USER_ID, email: 't5fki6643qty@gmail.com', aud: 'authenticated', role: 'authenticated', is_anonymous: false, email_confirmed_at: '2026-09-15T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} }
function session(sequence = 1) {
  const expiry = Math.floor(Date.now() / 1000) + 3600
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: owner.id, exp: expiry, seq: sequence, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'mock-signature'].join('.')
  return { access_token: token, token_type: 'bearer', expires_at: expiry, expires_in: 3600, refresh_token: 'mock-refresh-token', user: owner }
}
const record = newRecord('trouble', '検証用の記録者')
Object.assign(record, { id: ID, title: '【カタログ解説】検証メーカー CHECK-01 テスト機械（ミニ耕うん機）', category: 'ミニ耕うん機' })
record.meta.crop = 'ミニ耕うん機'
const publication = { id: ID, owner_id: owner.id, is_public: true, snapshot: publicSnapshot(record), published_at: '2026-09-15T00:00:00Z', updated_at: '2026-09-15T00:00:00Z' }
const results = []
const devServer = process.env.PRIVATE_TEST_EXTERNAL_SERVER === '1' ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', new URL(BASE).port || '4175', '--strictPort'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), env: { ...process.env, VITE_SUPABASE_URL: 'https://' + AUTH_HOST, VITE_SUPABASE_ANON_KEY: 'sb_publishable_browser_fixture' }, stdio: ['ignore', 'pipe', 'pipe'] })
if (devServer) await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('dev server did not start')), 15000)
  devServer.stdout.on('data', data => { if (String(data).includes('Local:')) { clearTimeout(timeout); resolve() } })
  devServer.once('exit', code => { clearTimeout(timeout); reject(new Error('dev server exited: ' + code)) })
  devServer.stderr.on('data', data => process.stderr.write(data))
})
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/tmp/chromium', args: ['--no-sandbox'] })
async function setup({ cached = null, serverUser = owner, width = 390, otpError = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 } })
  const tracking = { rest: [], auth: [], unexpected: [], errors: [], holdUser: false, release: null }
  await context.addInitScript(({ cached, key }) => {
    if (cached && !sessionStorage.getItem('auth-seeded')) { localStorage.setItem(key, JSON.stringify(cached)); sessionStorage.setItem('auth-seeded', '1') }
    localStorage.setItem('nitoron:workspace:v1:device', JSON.stringify({ records: [{ id: '22222222-2222-4222-8222-222222222222', title: 'PRIVATE-CACHE-SENTINEL', blocks: [] }], pending: {} }))
  }, { cached, key: KEY })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin === new URL(BASE).origin) return route.continue()
    if (url.hostname !== AUTH_HOST) { tracking.unexpected.push(url.origin); return route.abort() }
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': new URL(BASE).origin, 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range,x-supabase-api-version', 'x-supabase-api-version': '2024-01-01', 'content-range': '0-0/1' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 200, headers, body: '{}' })
    if (url.pathname.startsWith('/auth/v1/')) {
      tracking.auth.push({ path: url.pathname, body: request.postDataJSON() })
      if (url.pathname.endsWith('/otp') && otpError) return route.fulfill({ status: otpError.status, headers, body: JSON.stringify({ code: otpError.code, message: otpError.message }) })
      if (url.pathname.endsWith('/user')) {
        if (tracking.holdUser) await new Promise(resolve => { tracking.release = resolve })
        return route.fulfill({ status: serverUser ? 200 : 401, headers, body: JSON.stringify(serverUser || { code: 'bad_jwt', message: 'Mock expired session' }) })
      }
      if (url.pathname.endsWith('/token') || url.pathname.endsWith('/verify')) return route.fulfill({ status: 200, headers, body: JSON.stringify(session(2)) })
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers, body: '' })
      return route.fulfill({ status: 200, headers, body: '{}' })
    }
    tracking.rest.push(url.pathname)
    let data = []
    if (url.pathname === '/rest/v1/nitoron_publications' && url.searchParams.get('is_public') === 'eq.true') data = [publication]
    return route.fulfill({ status: 200, headers, body: JSON.stringify(data) })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => tracking.errors.push(error.message))
  return { page, context, tracking }
}
async function check(name, body) { await body(); results.push({ name, passed: true }); process.stdout.write(`PASS ${name}\n`) }
try {
  const anon = await setup()
  const routes = ['', '#/discover', '#/public/' + ID, '#/public/' + ID + '/manual/71', '#/list/mock-shared', '#/repairs', '#/repair/' + ID, '#/record/' + ID + '/content', '#/mine', '#/saved', '#/account', '#/user/' + owner.id, '#/compare', '#/talks']
  for (const route of routes) await check(`anonymous closed: ${route || '/'}`, async () => {
    await anon.page.goto(BASE + '/' + route)
    await anon.page.getByRole('button', { name: 'ログインメールを送る', exact: true }).waitFor()
    assert.equal(await anon.page.locator('.private-app,.record-card,canvas,.mobile-nav').count(), 0)
    assert.equal((await anon.page.locator('body').innerText()).includes('PRIVATE-CACHE-SENTINEL'), false)
    assert.equal(anon.tracking.rest.length, 0)
    assert.equal(anon.tracking.auth.length, 0)
  })
  await check('disallowed email sends no request', async () => {
    await anon.page.getByLabel('メールアドレス', { exact: true }).fill('other@example.test')
    await anon.page.getByRole('button', { name: 'ログインメールを送る', exact: true }).click()
    await anon.page.getByRole('alert').waitFor()
    assert.equal(anon.tracking.auth.length, 0)
  })
  await check('allowed email OTP has create_user=false and retains route', async () => {
    const original = anon.page.url()
    await anon.page.getByLabel('メールアドレス', { exact: true }).fill('T5FKI6643QTY@GMAIL.COM')
    await anon.page.getByRole('button', { name: 'ログインメールを送る', exact: true }).click()
    await anon.page.getByLabel('メールの確認コード', { exact: true }).waitFor()
    const sent = anon.tracking.auth.filter(x => x.path.endsWith('/otp'))
    assert.equal(sent.length, 1); assert.equal(sent[0].body.email, owner.email); assert.equal(sent[0].body.create_user, false)
    assert.equal(anon.page.url(), original)
    assert.equal(anon.tracking.rest.length, 0)
  })
  assert.deepEqual(anon.tracking.errors, []); assert.deepEqual(anon.tracking.unexpected, [])
  await anon.context.close()
  for(const error of [
    {status:429,code:'over_email_send_rate_limit',message:'Too many requests',expected:'over_email_send_rate_limit'},
    {status:400,code:'otp_disabled',message:'OTP disabled',expected:'otp_disabled'},
    {status:500,code:'hook_timeout',message:'Hook timed out',expected:'hook_timeout'},
    {status:500,code:'unexpected_failure',message:'Private upstream details（BREVO_IP_BLOCKED / 401）',expected:'BREVO_IP_BLOCKED'},
  ]) await check(`OTP failure shown without another send: ${error.expected}`, async()=>{
    const h=await setup({otpError:error})
    await h.page.goto(BASE+'/#/discover')
    await h.page.getByLabel('メールアドレス',{exact:true}).fill(owner.email)
    await h.page.getByRole('button',{name:'ログインメールを送る',exact:true}).click()
    const alert=h.page.getByRole('alert'); await alert.waitFor()
    const message=await alert.innerText()
    assert(message.includes(error.expected)); assert(message.includes(`HTTP ${error.status}`))
    assert(!message.includes('Private upstream details'))
    assert.equal(h.tracking.auth.filter(x=>x.path.endsWith('/otp')).length,1)
    assert.equal(h.tracking.rest.length,0)
    assert.equal(await h.page.getByLabel('メールの確認コード',{exact:true}).count(),0)
    assert.deepEqual(h.tracking.errors,[]); assert.deepEqual(h.tracking.unexpected,[])
    await h.context.close()
  })
  const forged = await setup({ cached: session(), serverUser: { ...owner, id: '99999999-9999-4999-8999-999999999999', email: 'other@example.test' } })
  await check('forged owner cache rejected against Auth user', async () => {
    await forged.page.goto(BASE + '/#/public/' + ID)
    await forged.page.getByRole('button', { name: 'ログインメールを送る', exact: true }).waitFor()
    assert(forged.tracking.auth.some(x => x.path.endsWith('/user')))
    assert.equal(forged.tracking.rest.length, 0); assert.equal(await forged.page.locator('.private-app').count(), 0)
  })
  assert.deepEqual(forged.tracking.errors, []); await forged.context.close()
  const own = await setup({ cached: session(), width: 1280 })
  await check('verified owner opens catalog', async () => {
    await own.page.goto(BASE + '/#/discover')
    await own.page.locator('.record-card').waitFor()
    assert.match(await own.page.locator('.record-card').innerText(), /CHECK-01/)
    assert(own.tracking.rest.length > 0)
  })
  await check('same owner refresh hides native dialog and preserves its draft', async () => {
    await own.page.getByRole('button', { name: '絞り込み', exact: true }).click()
    await own.page.getByLabel('機械の分類・作物', { exact: true }).fill('KEEP-THIS-DRAFT')
    own.tracking.holdUser = true
    await own.page.evaluate(async () => { const { supabase } = await import('/src/supabase.js'); await supabase.auth.refreshSession() })
    await own.page.locator('.private-app[hidden]').waitFor({ state: 'attached' })
    assert.equal(await own.page.locator('dialog').isVisible(), false)
    assert.equal(await own.page.getByLabel('機械の分類・作物', { exact: true }).inputValue(), 'KEEP-THIS-DRAFT')
    await own.page.waitForFunction(() => document.querySelector('.private-app')?.hidden === true)
    const releaseDeadline = Date.now() + 10000
    while (!own.tracking.release) { assert(Date.now() < releaseDeadline, 'refresh verification request did not arrive'); await new Promise(resolve => setTimeout(resolve, 10)) }
    own.tracking.holdUser = false; own.tracking.release()
    await own.page.locator('dialog').waitFor({ state: 'visible' })
    assert.equal(await own.page.getByLabel('機械の分類・作物', { exact: true }).inputValue(), 'KEEP-THIS-DRAFT')
    await own.page.getByRole('button', { name: '閉じる', exact: true }).click()
  })
  await check('logout closes all content while device cache remains', async () => {
    await own.page.goto(BASE + '/#/account/login')
    await own.page.getByRole('button', { name: 'ログアウト', exact: true }).waitFor()
    const cache = await own.page.evaluate(() => localStorage.getItem('nitoron:workspace:v1:device'))
    await own.page.getByRole('button', { name: 'ログアウト', exact: true }).click()
    await own.page.getByRole('button', { name: 'ログインメールを送る', exact: true }).waitFor()
    assert.equal(await own.page.locator('.private-app,.record-card,canvas').count(), 0)
    assert.equal(await own.page.evaluate(() => localStorage.getItem('nitoron:workspace:v1:device')), cache)
  })
  assert.deepEqual(own.tracking.errors, []); assert.deepEqual(own.tracking.unexpected, [])
  await own.context.close()
  const report = { checkedAt: new Date().toISOString(), mode: 'mock Auth and data only; no real email', browser: await browser.version(), baseUrl: BASE, passed: results.length, failed: 0, results }
  await writeFile(new URL('./browser-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
  process.stdout.write(`${results.length}/${results.length} passed\n`)
} catch (error) {
  await writeFile(new URL('./browser-check.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), passed: results.length, failed: 1, results, error: error.stack }, null, 2) + '\n')
  throw error
} finally { await browser.close(); devServer?.kill() }
