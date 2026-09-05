import { createClient } from '@supabase/supabase-js'

// The publishable (anon) key is safe to ship in client code; RLS controls access.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ycvbjzlqrxnwalhhgzat.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vtfjSahNmGXJ7_dvmYxbgg_ooMmGxcV'

// Without a key the app falls back to localStorage-only mode.
export const supabase = key ? createClient(url, key) : null

// RLS only grants access to the `authenticated` role, scoped per user.
// An anonymous session gives each device its own user without a login screen.
export async function ensureSession() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) return null
  return data.session
}
