import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

// Parse .env manually
const envContent = fs.readFileSync('.env', 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
    env[key] = val
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total, placed_at, assigned_vendor_id')
    .order('placed_at', { ascending: false })

  console.log('All Orders:', orders)
}

run()
