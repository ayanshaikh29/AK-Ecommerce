import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xgxqremmwxnwplhpvtux.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
  const { data, error } = await supabase.from('settings').select('b2b_customer_logins').eq('id', 'main').maybeSingle()
  if (error) {
    console.error("Error:", error)
  } else {
    console.log("JSON Saved:", JSON.stringify(data?.b2b_customer_logins || {}))
  }
}

run()
