import { createClient } from '@supabase/supabase-js'
import { privateAuthFetch } from './private-access.mjs'

// The publishable (anon) key is safe to ship in client code; RLS controls access.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ycvbjzlqrxnwalhhgzat.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vtfjSahNmGXJ7_dvmYxbgg_ooMmGxcV'

// Private access stays closed if the client cannot be configured.
export const supabase = key ? createClient(url, key, { global: { fetch: privateAuthFetch(url) } }) : null
