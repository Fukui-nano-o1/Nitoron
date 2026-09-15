// Client display and login-form guard. Database policies separately restrict
// data access. Direct Auth API email delivery needs a configured Send Email Hook;
// this client allowlist does not enforce the provider's outbound mail policy.
export const PRIVATE_USER_ID = '9e4163dc-56d3-4eba-9187-6534ecc8d607'
const PRIVATE_EMAIL = 't5fki6643qty@gmail.com'
export const normalizeLoginEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
export const isPrivateEmail = email => normalizeLoginEmail(email) === PRIVATE_EMAIL
export const isPrivateUser = user => !!user && user.id === PRIVATE_USER_ID && isPrivateEmail(user.email) && user.is_anonymous === false && !!user.email_confirmed_at

const rejectedEmail = () => new Error('このメールアドレスではログインできません。')
const AUTH_SEND_ERRORS = {
  over_email_send_rate_limit: 'メール送信が制限されています。しばらく待ってから再試行してください。',
  over_request_rate_limit: '送信要求が制限されています。しばらく待ってから再試行してください。',
  otp_disabled: '確認コードによるログインが無効になっています。',
  email_provider_disabled: 'メール認証が無効になっています。',
  email_address_not_authorized: '現在の配送設定では、この宛先への送信が許可されていません。',
  captcha_failed: 'ログインの認証チェックを完了できませんでした。',
  hook_timeout: 'メール送信Hookの応答が時間内に届きませんでした。',
  hook_timeout_after_retry: 'メール送信Hookの応答が時間内に届きませんでした。',
  hook_payload_invalid_content_type: 'メール送信Hookの応答形式を確認できませんでした。',
  hook_payload_over_size_limit: 'メール送信Hookのデータが上限を超えています。',
  request_timeout: '認証サーバーの応答が時間内に届きませんでした。',
  unexpected_failure: '認証サーバーで送信処理を完了できませんでした。',
  validation_failed: '認証サーバーが送信要求を受け付けませんでした。',
  bad_jwt: '認証サーバーへの接続設定を確認できませんでした。',
  user_banned: 'このアカウントは利用を停止されています。',
  user_not_found: 'ログインするアカウントを確認できませんでした。',
  signup_disabled: '新しいアカウントの登録は無効になっています。',
}
const HOOK_SEND_ERRORS = {
  HOOK_CONFIG: 'メール配送の設定が不足しています。',
  HOOK_SIGNATURE: 'メール送信Hookの署名を確認できませんでした。',
  HOOK_ACCOUNT: 'このログイン要求はメール送信Hookで許可されていません。',
  HOOK_CODE: '送信する確認コードの形式を確認できませんでした。',
  BREVO_IP_BLOCKED: 'メール配送サービスが送信元IPを拒否しました。',
  BREVO_REJECTED: 'メール配送サービスが送信を受け付けませんでした。',
  BREVO_TIMEOUT: 'メール配送サービスの応答が時間内に届きませんでした。',
  BREVO_CONNECTION: 'メール配送サービスとの通信を完了できませんでした。',
  BREVO_RESPONSE: 'メール配送の受付を確認できませんでした。',
  RESEND_REJECTED: 'メール配送サービスが送信を受け付けませんでした。',
  RESEND_TIMEOUT: 'メール配送サービスの応答が時間内に届きませんでした。',
  RESEND_CONNECTION: 'メール配送サービスとの通信を完了できませんでした。',
  RESEND_RESPONSE: 'メール配送の受付を確認できませんでした。',
}
export function loginSendError(error) {
  // Provider text can contain keys, codes or URLs. Display only known codes.
  const message = typeof error?.message === 'string' ? error.message.slice(0,8192) : ''
  const retainedCode = message.match(/\[NITORON_AUTH_CODE:([a-z_]+)\]/)?.[1]
  const code = Object.hasOwn(AUTH_SEND_ERRORS, error?.code) ? error.code : Object.hasOwn(AUTH_SEND_ERRORS, retainedCode) ? retainedCode : 'AUTH_SEND_FAILED'
  const hook = message.match(/(?:^|[\s(（])((?:HOOK_(?:CONFIG|SIGNATURE|ACCOUNT|CODE)|BREVO_IP_BLOCKED|(?:BREVO|RESEND)_(?:REJECTED|TIMEOUT|CONNECTION|RESPONSE)))(?:\s*\/\s*(?:HTTP\s+[45][0-9]{2}\s*\/\s*配送\s+)?([45][0-9]{2}))?(?=$|[\s)）])/)
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : null
  const network = error?.name === 'AuthRetryableFetchError' || error?.name === 'TypeError'
  const text = hook ? HOOK_SEND_ERRORS[hook[1]] : AUTH_SEND_ERRORS[code] || (status === 429 ?
    '送信要求が制限されています。しばらく待ってから再試行してください。' : network ?
    '認証サーバーとの通信を完了できませんでした。' : 'メールを送れませんでした。')
  const details = [hook?.[1] || code, status ? `HTTP ${status}` : 'HTTP不明', ...(hook?.[2] ? [`配送 ${hook[2]}`] : [])]
  return new Error(`${text}（${details.join(' / ')}）`)
}
export function privateAuthFetch(baseUrl, request = fetch) {
  const endpoint = new URL('/auth/v1/otp',baseUrl).href
  return async (input, options) => {
    const response = await request(input,options)
    // auth-js keeps the HTTP status/message of 5xx responses but drops `code`.
    // Preserve only a known code in the error message of this one endpoint.
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = options?.method || input?.method || 'GET'
    if (method.toUpperCase() !== 'POST' || url.split('?')[0] !== endpoint || response.status < 500) return response
    try {
      const body = await response.clone().json()
      const code = body.code || body.error_code
      if (!Object.hasOwn(AUTH_SEND_ERRORS,code)) return response
      const message = `${loginSendError({status:response.status,code,message:body.msg || body.message}).message} [NITORON_AUTH_CODE:${code}]`
      const headers = new Headers(response.headers)
      headers.delete('content-length'); headers.delete('content-encoding')
      return new Response(JSON.stringify({...body,message,...(typeof body.msg === 'string' ? {msg:message} : {})}),{status:response.status,statusText:response.statusText,headers})
    } catch { return response }
  }
}
export async function sendPrivateLogin(auth, email, redirectTo) {
  if (!isPrivateEmail(email)) throw rejectedEmail()
  if (!auth) throw new Error('ログインを利用できません。時間をおいて再読み込みしてください。')
  let result
  try {
    result = await auth.signInWithOtp({ email: normalizeLoginEmail(email), options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
  } catch (error) { throw loginSendError(error) }
  if (result.error) throw loginSendError(result.error)
}

export async function verifyPrivateLogin(auth, email, token) {
  if (!isPrivateEmail(email)) throw rejectedEmail()
  if (!auth) throw new Error('ログインを利用できません。時間をおいて再読み込みしてください。')
  const { error } = await auth.verifyOtp({ email: normalizeLoginEmail(email), token: token.trim(), type: 'email' })
  if (error) throw new Error('コードを確認してください。有効期限が切れた場合は送り直してください。')
  // The page guard opens only after its separate getUser verification succeeds.
}

// Auth event payloads and localStorage are not authorization evidence. Each new
// session is checked against Auth's /user endpoint before the app can mount.
// Deferred work keeps Supabase's synchronous auth callback free of Auth calls.
export function watchPrivateAccess(auth, onChange) {
  let stopped = false, revision = 0, timer = null, verifiedSession = null
  const emit = (status, session = null) => { if (!stopped) onChange({ status, session }) }
  const check = async (session, version) => {
    if (!session?.access_token) { if (version === revision) emit('login'); return }
    try {
      const { data, error } = await auth.getUser(session.access_token)
      if (stopped || version !== revision) return
      if (error || !isPrivateUser(data?.user)) { verifiedSession = null; emit('login'); return }
      verifiedSession = { ...session, user: data.user }
      emit('allowed', verifiedSession)
    } catch { if (version === revision) { verifiedSession = null; emit('login') } }
  }
  const accept = (session, event) => {
    const version = ++revision
    clearTimeout(timer)
    // Preserve in-progress forms behind a hidden/inert guard while checking a
    // refresh of the same identity. Never mount the new, unverified session.
    const continuing = verifiedSession && isPrivateUser(session?.user) &&
      (session.access_token === verifiedSession.access_token || ['TOKEN_REFRESHED', 'USER_UPDATED'].includes(event))
    if (!continuing) verifiedSession = null
    emit(session?.access_token ? 'checking' : 'login', verifiedSession)
    if (session?.access_token) timer = setTimeout(() => { if (!stopped && version === revision) check(session, version) }, 0)
  }
  emit(auth ? 'checking' : 'unavailable')
  if (!auth) return () => { stopped = true }
  const { data } = auth.onAuthStateChange((event, session) => accept(event === 'SIGNED_OUT' ? null : session, event))
  const initialRevision = revision
  Promise.resolve().then(() => auth.getSession()).then(({ data, error }) => {
    if (!stopped && revision === initialRevision) accept(error ? null : data?.session)
  }).catch(() => { if (!stopped && revision === initialRevision) accept(null) })
  return () => { stopped = true; revision++; clearTimeout(timer); data.subscription.unsubscribe() }
}
