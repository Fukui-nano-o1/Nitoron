// This hook is inactive until connected in Nitoron's Auth Hooks settings.
// Do not log the signed payload, OTP, API key, or provider response body.
export const OWNER_ID = '9e4163dc-56d3-4eba-9187-6534ecc8d607'
export const OWNER_EMAIL = 't5fki6643qty@gmail.com'
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
const reply = (status, message) => new Response(JSON.stringify(message ? {
  error: { http_code: status, message },
} : {}), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export function createEmailHandler({ Webhook, env, request = fetch }) {
  return async req => {
    if (req.method !== 'POST') return reply(405, 'POST required')
    const secret = env('SEND_EMAIL_HOOK_SECRET')?.trim()
    const apiKey = env('BREVO_API_KEY')?.trim()
    if (!secret || !apiKey) return reply(503, 'Email delivery is not configured')
    if (Number(req.headers.get('content-length') || 0) > 65536) return reply(413, 'Request too large')
    let payload
    try {
      const raw = await req.text()
      if (raw.length > 65536) return reply(413, 'Request too large')
      // Auth supplies Standard Webhooks signatures, not a user JWT.
      payload = new Webhook(secret.replace(/^v1,whsec_/, '')).verify(raw, Object.fromEntries(req.headers))
    } catch { return reply(401, 'Invalid webhook signature') }
    const { user, email_data: data } = payload || {}
    if (user?.id !== OWNER_ID || normalize(user?.email) !== OWNER_EMAIL || user?.new_email ||
      data?.email_action_type !== 'magiclink') return reply(403, 'Private login only')
    if (typeof data.token !== 'string' || !/^[0-9]{6,8}$/.test(data.token)) return reply(400, 'Invalid login code')
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
      if (!response.ok) return reply(502, 'Email delivery failed')
      const result = await response.json()
      if (typeof result.messageId !== 'string' || !result.messageId) return reply(502, 'Email delivery not confirmed')
      return reply(200)
    } catch { return reply(502, 'Email delivery failed') }
  }
}
