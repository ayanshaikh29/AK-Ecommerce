import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

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

// Helper to fetch editable site content (CMS) for public pages
export async function getSiteContent(page) {
  const supabase = getSupabase()
  if (!supabase) {
    console.error('[getSiteContent] Supabase client not initialized — check SUPABASE_SERVICE_ROLE_KEY in .env')
    return {}
  }
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('b2b_customer_logins')
      .eq('id', 'main')
      .maybeSingle()

    if (error) {
      console.error('[getSiteContent] Query error:', error.message)
      return {}
    }

    let cms = {}
    if (data && data.b2b_customer_logins) {
      cms = typeof data.b2b_customer_logins === 'string'
        ? JSON.parse(data.b2b_customer_logins)
        : data.b2b_customer_logins
      if (Array.isArray(cms)) cms = {}
    }

    const map = {}
    for (const [key, item] of Object.entries(cms)) {
      const parts = key.split(':')
      if (parts.length === 2) {
        const [p, s] = parts
        if (!page || p === page) {
          map[s] = { value: item.value, type: item.type }
        }
      }
    }
    return map
  } catch (e) {
    console.error('[getSiteContent] Exception:', e)
    return {}
  }
}
