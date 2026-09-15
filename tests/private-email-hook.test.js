import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { Webhook } from 'standardwebhooks'
import { createEmailHandler, OWNER_ID, OWNER_EMAIL } from '../supabase/functions/nitoron-private-email/handler.mjs'

const secret = Buffer.alloc(32, 7).toString('base64') // Fixture, never a deployment secret.
const event = () => ({ user: { id: OWNER_ID, email: OWNER_EMAIL }, email_data: { email_action_type: 'magiclink', token: '123456' } })
function signed(body = event(), { timestamp = Math.floor(Date.now()/1000), badSignature = false } = {}) {
  const raw = JSON.stringify(body), id = 'msg_fixture'
  const signature = createHmac('sha256', Buffer.from(secret,'base64')).update(`${id}.${timestamp}.${raw}`).digest('base64')
  return new Request('https://example.test/hook', { method: 'POST', body: raw, headers: {
    'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(timestamp),
    'webhook-signature': 'v1,' + (badSignature ? Buffer.alloc(32).toString('base64') : signature),
  } })
}
function setup({ values, response, failure } = {}) {
  const calls = []
  const config = values || { SEND_EMAIL_HOOK_SECRET: 'v1,whsec_' + secret, BREVO_API_KEY: 'fixture-api-key' }
  const handler = createEmailHandler({ Webhook, env: key => config[key], request: async (...args) => {
    calls.push(args)
    if (failure) throw new Error('provider secret detail must not escape')
    return response || Response.json({ messageId: 'mock-message-id' }, { status: 201 })
  } })
  return { handler, calls }
}

test('署名済み本人magiclinkだけ、固定宛先へ確認コードを送る',async()=>{
  const h=setup(), result=await h.handler(signed())
  assert.equal(result.status,200); assert.deepEqual(await result.json(),{}); assert.equal(h.calls.length,1)
  const [url,options]=h.calls[0], mail=JSON.parse(options.body)
  assert.equal(url,'https://api.brevo.com/v3/smtp/email')
  assert.deepEqual(mail.to,[{email:OWNER_EMAIL}]); assert.deepEqual(mail.sender,{name:'Nitoron',email:OWNER_EMAIL})
  assert.match(mail.textContent,/123456/); assert.equal(mail.subject,'Nitoron ログイン確認コード')
  assert.equal(options.headers['api-key'],'fixture-api-key'); assert(options.signal)
  assert.equal(mail.cc,undefined); assert.equal(mail.bcc,undefined)
})
test('偽署名・署名なし・期限切れは配送0件',async()=>{
  for (const request of [signed(event(),{badSignature:true}),signed(event(),{timestamp:1}),new Request('https://example.test',{method:'POST',body:JSON.stringify(event())})]) {
    const h=setup(); assert.equal((await h.handler(request)).status,401); assert.equal(h.calls.length,0)
  }
})
test('実在する別ユーザー・別メール・新メール宛ては署名が正しくても配送0件',async()=>{
  for (const user of [{id:'other',email:OWNER_EMAIL},{id:OWNER_ID,email:'other@example.test'},
    {id:OWNER_ID,email:OWNER_EMAIL,new_email:'other@example.test'},null]) {
    const h=setup(); assert.equal((await h.handler(signed({...event(),user}))).status,403); assert.equal(h.calls.length,0)
  }
})
test('新規登録・招待・回復・メール変更等の経路をログイン送信へ流用しない',async()=>{
  for(const type of ['signup','invite','recovery','email_change','reauthentication','unknown']) {
    const body=event(); body.email_data.email_action_type=type
    const h=setup(); assert.equal((await h.handler(signed(body))).status,403); assert.equal(h.calls.length,0)
  }
})
test('本人メールの表記揺れは固定宛先へ正規化される',async()=>{
  const body=event(); body.user.email=' T5FKI6643QTY@GMAIL.COM '
  const h=setup(); assert.equal((await h.handler(signed(body))).status,200)
  assert.deepEqual(JSON.parse(h.calls[0][1].body).to,[{email:OWNER_EMAIL}])
})
test('設定不足・不正コード・GETは配送0件',async()=>{
  for(const config of [{},{SEND_EMAIL_HOOK_SECRET:'v1,whsec_'+secret},{BREVO_API_KEY:'key'}]) {
    const h=setup({values:config}); assert.equal((await h.handler(signed())).status,503); assert.equal(h.calls.length,0)
  }
  for(const token of ['',123456,'123456\nINJECT','<html>', '12']) {
    const body=event(); body.email_data.token=token
    const h=setup(); assert.equal((await h.handler(signed(body))).status,400); assert.equal(h.calls.length,0)
  }
  const h=setup(); assert.equal((await h.handler(new Request('https://example.test'))).status,405); assert.equal(h.calls.length,0)
})
test('Brevo失敗・タイムアウト・不明な応答を送信成功にせず、秘密を返さない',async()=>{
  for (const params of [{response:Response.json({message:'private provider detail'},{status:401})},{response:Response.json({})},{failure:true}]) {
    const h=setup(params), result=await h.handler(signed())
    assert.equal(result.status,502); const text=await result.text()
    assert(!text.includes('123456')); assert(!text.includes('private provider detail')); assert(!text.includes('fixture-api-key'))
  }
})
