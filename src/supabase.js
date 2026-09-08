import { createClient } from '@supabase/supabase-js'

// The publishable (anon) key is safe to ship in client code; RLS controls access.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ycvbjzlqrxnwalhhgzat.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vtfjSahNmGXJ7_dvmYxbgg_ooMmGxcV'

// Without a key the app falls back to localStorage-only mode.
export const supabase = key ? createClient(url, key) : null

// RLS only grants access to the `authenticated` role, scoped per user.
// An anonymous session gives each device its own user without a login screen.
// プロジェクト側で匿名サインインが無効な場合は「未ログイン」を通常状態として扱う。
let anonymousDisabled = false
export const loginRequired = () => anonymousDisabled

let establishing
export async function ensureSession() {
  if (!supabase) return null
  if (!establishing) establishing = (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) return session
    if (anonymousDisabled) return null
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      if (error.code === 'anonymous_provider_disabled' || error.status === 422) anonymousDisabled = true
      return null
    }
    return data.session
  })().finally(() => { establishing = null })
  return establishing
}
