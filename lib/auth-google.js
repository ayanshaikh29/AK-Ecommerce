import { createClient } from '@supabase/supabase-js'

export async function signInWithGoogle(returnTo = '/products') {
  try {
    const res = await fetch('/api/realtime-config')
    if (!res.ok) throw new Error('Failed to load authentication configuration')
    const { supabaseUrl, supabaseKey } = await res.json()

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase Auth configuration is missing')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const redirectUrl = `${origin}/auth/callback?redirect=${encodeURIComponent(returnTo)}`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account'
        }
      }
    })

    if (error) throw error
    return data
  } catch (err) {
    console.error('Google Sign-In Error:', err)
    throw err
  }
}
