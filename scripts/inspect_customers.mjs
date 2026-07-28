import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

try {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=')
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
  })
} catch (e) {}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function inspectData() {
  console.log('=== USERS TABLE ===')
  const { data: users, error: uErr } = await supabase.from('users').select('*')
  console.log('Users error:', uErr)
  console.log('Users count:', users?.length)
  console.log('Users list:', JSON.stringify(users, null, 2))

  console.log('\n=== CUSTOMER LOGINS TABLE ===')
  const { data: logins, error: lErr } = await supabase.from('customer_logins').select('*')
  console.log('Logins error:', lErr)
  console.log('Logins count:', logins?.length)
  console.log('Logins list:', JSON.stringify(logins, null, 2))

  console.log('\n=== SETTINGS customer_logins_data ===')
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 'customer_logins_data')
  console.log('Settings customer_logins_data:', JSON.stringify(settings, null, 2))
}

inspectData()
