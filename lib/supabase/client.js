import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let _clientSingleton = null

/**
 * Shared Supabase Browser Client.
 * Safe for client-side React components & hooks.
 * Never throws uncaught "supabaseKey is required." exceptions.
 */
export function getSupabaseBrowserClient() {
  if (_clientSingleton) return _clientSingleton

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase Client Warning]: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.')
    return null
  }

  try {
    _clientSingleton = createClient(supabaseUrl, supabaseAnonKey)
    return _clientSingleton
  } catch (err) {
    console.error('[Supabase Client Init Exception]:', err?.message)
    return null
  }
}
