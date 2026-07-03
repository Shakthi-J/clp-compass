import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
    )
  }
  return _supabase
}

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
    )
  }
  return _supabaseAdmin
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) => (getSupabase() as unknown as Record<string | symbol, unknown>)[prop],
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get: (_, prop) => (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop],
})
