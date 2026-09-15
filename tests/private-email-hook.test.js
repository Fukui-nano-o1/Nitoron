import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { Webhook } from 'standardwebhooks'
import { createEmailHandler, OWNER_ID, OWNER_EMAIL } from '../supabase/functions/nitoron-private-email/handler.mjs'

const secret = Buffer.alloc(32, 7).toString('base64') // Fixture, never a deployment secret.
const event = () => ({ user: { id: OWNER_ID, email: OWNER_EMAIL }, email_data: { email_action_type: 'magiclink', token: '123456' } })
function signed(body = event(), { timestamp = Math.floor(Date.now()/1000), badSignature = false, id = 'msg_fixture' } = {}) {
  const raw = JSON.stringify(body)
  const signature = createHmac('sha256', Buffer.from(secret,'base64')).update(`${id}.${timestamp}.${raw}`).digest('base64')
  return new Request('https://example.test/hook', { method: 'POST', body: raw, headers: {
    'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(timestamp),
    'webhook-signature': 'v1,' + (badSignature ? Buffer.alloc(32).toString('base64') : signature),
  } })
}
function setup({ values, response, failure, report, provider = 'brevo' } = {}) {
  const calls = [], diagnostics = []
  const config = values || { SEND_EMAIL_HOOK_SECRET: 'v1,whsec_' + secret, ...(provider === 'resend' ?
    { NITORON_EMAIL_PROVIDER: 'resend', NITORON_RESEND_API_KEY: 're_fixture' } : { BREVO_API_KEY: 'fixture-api-key' }) }
  const handler = createEmailHandler({ Webhook, env: key => config[key], report: report || (entry => diagnostics.push(entry)), request: async (...args) => {
    calls.push(args)
    if (failure) throw (failure instanceof Error ? failure : new Error('provider secret detail must not escape'))
    return response || (provider === 'resend' ? Response.json({ id: 'mock-resend-id' }) : Response.json({ messageId: 'mock-message-id' }, { status: 201 }))
  } })
  return { handler, calls, diagnostics }
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
test('配送側がIP拒否を明記した場合だけIP拒否と判定し、401だけでは断定しない',async()=>{
  const cases = [
    [401,'We have detected you are using an unrecognised IP address 2001:db8::1','BREVO_IP_BLOCKED'],
    [401,'Key not found','BREVO_REJECTED'],
    [400,'Invalid sender email','BREVO_REJECTED'],
    [429,'Too many requests','BREVO_REJECTED'],
  ]
  for(const [status,message,code] of cases) {
    const h=setup({response:Response.json({message},{status})}), result=await h.handler(signed())
    assert.equal(result.status,502)
    assert.match((await result.json()).error.message,new RegExp(code))
    assert.deepEqual(h.diagnostics,[{event:'private_login_email',code,status:502,providerStatus:status}])
  }
})
test('ログにも応答にもコード・宛先・キー・署名・配送側の生の詳細を出さない',async()=>{
  const details=`unrecognised IP address 2001:db8::1 ${OWNER_EMAIL} 123456 fixture-api-key ${secret}`
  const h=setup({response:Response.json({message:details,code:details},{status:401})}), result=await h.handler(signed())
  const output=JSON.stringify(h.diagnostics)+await result.text()
  for(const privateValue of [OWNER_EMAIL,OWNER_ID,'123456','fixture-api-key',secret,'2001:db8::1']) assert(!output.includes(privateValue))
  const success=setup(); await success.handler(signed())
  assert.deepEqual(success.diagnostics,[{event:'private_login_email',code:'BREVO_ACCEPTED',status:200,providerStatus:201}])
})
test('タイムアウトと接続失敗を区別し、ログ障害でも本人制限を維持する',async()=>{
  const h=setup({failure:new DOMException('private detail','TimeoutError')}), result=await h.handler(signed())
  assert.equal(result.status,502); assert.match((await result.json()).error.message,/BREVO_TIMEOUT/)
  const loggingFailure=setup({report:()=>{throw new Error('logger failed')}})
  assert.equal((await loggingFailure.handler(signed())).status,200)
  const other=event(); other.user.id='other'
  assert.equal((await loggingFailure.handler(signed(other))).status,403)
  assert.equal(loggingFailure.calls.length,1)
})

test('Resendは本人の固定宛先へ送信し、署名済み入力でも宛先・本文・送信者を差し替えさせない',async()=>{
  const h=setup({provider:'resend'}), body=event()
  Object.assign(body.email_data,{to:'other@example.test',from:'attacker@example.test',cc:['other@example.test'],subject:'INJECT',text:'INJECT'})
  const result=await h.handler(signed(body))
  assert.equal(result.status,200); assert.deepEqual(await result.json(),{})
  assert.equal(h.calls.length,1)
  const [url,options]=h.calls[0], mail=JSON.parse(options.body)
  assert.equal(url,'https://api.resend.com/emails')
  assert.deepEqual(mail,{from:'Nitoron <onboarding@resend.dev>',to:[OWNER_EMAIL],subject:'Nitoron ログイン確認コード',text:`ログイン確認コード：123456\n\nNitoronの画面に入力してください。\nこのコードは他の人に教えないでください。\n心当たりがない場合は、このメールを破棄してください。`})
  assert.equal(options.headers.Authorization,'Bearer re_fixture'); assert.equal(options.headers['api-key'],undefined)
  assert(options.signal)
  assert.deepEqual(h.diagnostics,[{event:'private_login_email',code:'RESEND_ACCEPTED',status:200,providerStatus:200}])
})

test('Resendでも署名・本人・用途・コードの全境界を守り、配送前に拒否する',async()=>{
  const cases=[
    [signed(event(),{badSignature:true}),401], [signed(event(),{timestamp:1}),401],
    [new Request('https://example.test',{method:'POST',body:JSON.stringify(event())}),401],
    [signed({...event(),user:{id:'other',email:OWNER_EMAIL}}),403],
    [signed({...event(),user:{id:OWNER_ID,email:'other@example.test'}}),403],
    [signed({...event(),user:{id:OWNER_ID,email:OWNER_EMAIL,new_email:'other@example.test'}}),403],
    ...['signup','invite','recovery','email_change','reauthentication','unknown'].map(type=>[signed({...event(),email_data:{email_action_type:type,token:'123456'}}),403]),
    [signed({...event(),email_data:{email_action_type:'magiclink',token:'123456\nINJECT'}}),400],
  ]
  for(const [request,status] of cases) {
    const h=setup({provider:'resend'})
    assert.equal((await h.handler(request)).status,status); assert.equal(h.calls.length,0)
  }
})

test('Resend用キー不足・未対応の配送設定では他社へフォールバックしない',async()=>{
  for(const values of [
    {SEND_EMAIL_HOOK_SECRET:'v1,whsec_'+secret,NITORON_EMAIL_PROVIDER:'resend',BREVO_API_KEY:'fixture-api-key'},
    {SEND_EMAIL_HOOK_SECRET:'v1,whsec_'+secret,NITORON_EMAIL_PROVIDER:'unknown',BREVO_API_KEY:'fixture-api-key'},
    {NITORON_EMAIL_PROVIDER:'resend',NITORON_RESEND_API_KEY:'re_fixture'},
  ]) {
    const h=setup({values}), result=await h.handler(signed())
    assert.equal(result.status,503); assert.equal(h.calls.length,0)
    assert.match((await result.json()).error.message,/HOOK_CONFIG/)
  }
})

test('Resend失敗時は再送・Brevoへの迂回・成功表示をせず、秘密を露出しない',async()=>{
  const details=`${OWNER_EMAIL} ${OWNER_ID} re_fixture 123456 ${secret}`
  const cases=[
    [{response:Response.json({message:details},{status:401})},'RESEND_REJECTED'],
    [{response:Response.json({message:details},{status:403})},'RESEND_REJECTED'],
    [{response:Response.json({message:details},{status:429})},'RESEND_REJECTED'],
    [{response:Response.json({})},'RESEND_RESPONSE'],
    [{failure:new DOMException(details,'TimeoutError')},'RESEND_TIMEOUT'],
    [{failure:new Error(details)},'RESEND_CONNECTION'],
  ]
  for(const [params,code] of cases) {
    const h=setup({provider:'resend',...params}), result=await h.handler(signed())
    assert.equal(result.status,502); assert.equal(h.calls.length,1)
    assert.equal(h.calls[0][0],'https://api.resend.com/emails')
    const output=JSON.stringify(h.diagnostics)+await result.text()
    assert(output.includes(code))
    for(const privateValue of [OWNER_EMAIL,OWNER_ID,'123456','re_fixture',secret]) assert(!output.includes(privateValue))
  }
})

test('同じ署名済みHookの再実行では同じ配送重複防止キーを使い、別の要求とは分離する',async()=>{
  const h=setup({provider:'resend'})
  for(const id of ['msg_same','msg_same','msg_other']) assert.equal((await h.handler(signed(event(),{id}))).status,200)
  const keys=h.calls.map(([,options])=>options.headers['Idempotency-Key'])
  assert.equal(keys[0],keys[1]); assert.notEqual(keys[0],keys[2])
  assert.match(keys[0],/^nitoron-login\/[0-9a-f]{64}$/)
  for(const privateValue of [OWNER_EMAIL,OWNER_ID,'123456','re_fixture',secret]) assert(!keys.join('').includes(privateValue))
})
