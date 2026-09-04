import { createClient } from '@supabase/supabase-js'

// The publishable (anon) key is safe to ship in client code; RLS controls access.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ycvbjzlqrxnwalhhgzat.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vtfjSahNmGXJ7_dvmYxbgg_ooMmGxcV'

// Without a key the app falls back to localStorage-only mode.
export const supabase = key ? createClient(url, key) : null
