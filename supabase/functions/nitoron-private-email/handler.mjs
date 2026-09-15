// This hook is inactive until connected in Nitoron's Auth Hooks settings.
// Do not log the signed payload, OTP, API key, or provider response body.
export const OWNER_ID = '9e4163dc-56d3-4eba-9187-6534ecc8d607'
export const OWNER_EMAIL = 't5fki6643qty@gmail.com'
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
const reply = (status, message) => new Response(JSON.stringify(message ? {
  error: { http_code: status, message },
} : {}), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export function createEmailHandler({ Webhook, env, request = fetch, report = entry => console.info(JSON.stringify(entry)) }) {
  // Only our fixed reason codes and HTTP statuses enter logs. Never provider text.
  const diagnostic = (code, status, providerStatus) => {
    try { report({ event: 'private_login_email', code, status, ...(providerStatus ? { providerStatus } : {}) }) } catch {}
  }
  const fail = (status, code, message, providerStatus) => {
    diagnostic(code, status, providerStatus)
    return reply(status, `${message}（${code}${providerStatus ? ` / ${providerStatus}` : ''}）`)
  }
  return async req => {
    if (req.method !== 'POST') return reply(405, 'POST required')
    const secret = env('SEND_EMAIL_HOOK_SECRET')?.trim()
    const apiKey = env('BREVO_API_KEY')?.trim()
    if (!secret || !apiKey) return fail(503, 'HOOK_CONFIG', 'メール配送の設定が不足しています')
    if (Number(req.headers.get('content-length') || 0) > 65536) return reply(413, 'Request too large')
    let payload
    try {
      const raw = await req.text()
      if (raw.length > 65536) return reply(413, 'Request too large')
      // Auth supplies Standard Webhooks signatures, not a user JWT.
      payload = new Webhook(secret.replace(/^v1,whsec_/, '')).verify(raw, Object.fromEntries(req.headers))
    } catch { return fail(401, 'HOOK_SIGNATURE', 'メール送信Hookの署名を確認できません') }
    const { user, email_data: data } = payload || {}
    if (user?.id !== OWNER_ID || normalize(user?.email) !== OWNER_EMAIL || user?.new_email ||
      data?.email_action_type !== 'magiclink') return fail(403, 'HOOK_ACCOUNT', 'このログイン要求は許可されていません')
    if (typeof data.token !== 'string' || !/^[0-9]{6,8}$/.test(data.token)) return fail(400, 'HOOK_CODE', '確認コードの形式を確認できません')
    try {
      const response = await request('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
        // Complete within Supabase's five-second Auth HTTP hook budget.
        signal: AbortSignal.timeout(3500),
        body: JSON.stringify({
          sender: { name: 'Nitoron', email: OWNER_EMAIL },
          to: [{ email: OWNER_EMAIL }],
          subject: 'Nitoron ログイン確認コード',
          textContent: `ログイン確認コード：${data.token}\n\nNitoronの画面に入力してください。\nこのコードは他の人に教えないでください。\n心当たりがない場合は、このメールを破棄してください。`,
        }),
      })
      if (!response.ok) {
        let providerMessage = ''
        try {
          const error = await response.json()
          if (typeof error?.message === 'string') providerMessage = error.message.slice(0,4096)
        } catch {}
        // A 401 alone does not prove an IP block: it can also mean a bad API key.
        const ipBlocked = [401,403].includes(response.status) &&
          /\b(?:unrecognised|unrecognized|unauthorized|unauthorised|unapproved)\s+IP\s+address\b/i.test(providerMessage)
        return fail(502, ipBlocked ? 'BREVO_IP_BLOCKED' : 'BREVO_REJECTED',
          ipBlocked ? 'Brevoが送信元IPを拒否しました' : 'Brevoがメール配送を受け付けませんでした', response.status)
      }
      const result = await response.json()
      if (typeof result.messageId !== 'string' || !result.messageId) return fail(502, 'BREVO_RESPONSE', '配送受付を確認できません', response.status)
      diagnostic('BREVO_ACCEPTED', 200, response.status)
      return reply(200)
    } catch (error) {
      if (['TimeoutError','AbortError'].includes(error?.name)) return fail(502, 'BREVO_TIMEOUT', 'メール配送の応答が時間内に届きませんでした')
      return fail(502, 'BREVO_CONNECTION', 'メール配送との通信を完了できませんでした')
    }
  }
}
