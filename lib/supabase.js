import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let _supabase = null

export function getSupabase() {
  if (_supabase) return _supabase

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase Warning]: Missing Supabase credentials in environment variables.')
    return null
  }

  try {
    _supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })
    return _supabase
  } catch (err) {
    console.error('[Supabase Init Exception]:', err?.message)
    return null
  }
}

// Helper to fetch global settings for layout/server components
export async function getSettings() {
  const supabase = getSupabase()
  if (!supabase) return {}
  try {
    const { data } = await supabase
      .from('settings')
      .select('brand_name,brand_tagline,marquee_messages,contact_email,contact_phone,whatsapp_number,whatsapp_message,address,footer_description')
      .eq('id', 'main')
      .maybeSingle()
    return data || {}
  } catch (e) {
    return {}
  }
}
