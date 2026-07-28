import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let _serverSingleton = null

/**
 * Shared Supabase Server Client.
 * Safe for API routes & server components.
 * Never throws uncaught "supabaseKey is required." exceptions.
 */
export function getSupabaseServerClient() {
  if (_serverSingleton) return _serverSingleton

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[Supabase Server Warning]: Supabase credentials missing on server.')
    return null
  }

  try {
    _serverSingleton = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    return _serverSingleton
  } catch (err) {
    console.error('[Supabase Server Init Exception]:', err?.message)
    return null
  }
}
