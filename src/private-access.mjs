// Client display and login-form guard. Database policies separately restrict
// data access. Direct Auth API email delivery needs a configured Send Email Hook;
// this client allowlist does not enforce the provider's outbound mail policy.
export const PRIVATE_USER_ID = '9e4163dc-56d3-4eba-9187-6534ecc8d607'
const PRIVATE_EMAIL = 't5fki6643qty@gmail.com'
export const normalizeLoginEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
export const isPrivateEmail = email => normalizeLoginEmail(email) === PRIVATE_EMAIL
export const isPrivateUser = user => !!user && user.id === PRIVATE_USER_ID && isPrivateEmail(user.email) && user.is_anonymous === false && !!user.email_confirmed_at

const rejectedEmail = () => new Error('このメールアドレスではログインできません。')
export async function sendPrivateLogin(auth, email, redirectTo) {
  if (!isPrivateEmail(email)) throw rejectedEmail()
  if (!auth) throw new Error('ログインを利用できません。時間をおいて再読み込みしてください。')
  const { error } = await auth.signInWithOtp({ email: normalizeLoginEmail(email), options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
  if (error) throw new Error('メールを送れませんでした。時間をおいて再試行してください。')
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
