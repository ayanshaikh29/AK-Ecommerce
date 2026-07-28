import { readFileSync } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve('.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
  env[key] = val
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

async function run() {
  console.log('Verifying B2B database tables...')
  
  // 1. customer_product_pricing table check
  const { error: err1 } = await supabase.from('customer_product_pricing').select('id').limit(1)
  if (err1) console.log('customer_product_pricing table missing/error:', err1.message)
  else console.log('customer_product_pricing table exists!')

  // 2. stock_movements table check
  const { error: err2 } = await supabase.from('stock_movements').select('id').limit(1)
  if (err2) console.log('stock_movements table missing/error:', err2.message)
  else console.log('stock_movements table exists!')

  // 3. vendors table check
  const { error: err3 } = await supabase.from('vendors').select('id').limit(1)
  if (err3) console.log('vendors table missing/error:', err3.message)
  else console.log('vendors table exists!')

  // 4. customer_logins table check (for admin login activity tracking)
  const { error: err4 } = await supabase.from('customer_logins').select('id').limit(1)
  if (err4) console.log('customer_logins table missing/error:', err4.message)
  else console.log('customer_logins table exists!')

  // 5. settings.b2b_customer_logins column check
  const { error: err5 } = await supabase.from('settings').select('b2b_customer_logins').eq('id', 'main').maybeSingle()
  if (err5) console.log('settings.b2b_customer_logins column missing:', err5.message)
  else console.log('settings.b2b_customer_logins column exists!')

  // 6. catalog_requests table check (for admin catalog access request tracking)
  const { error: err6 } = await supabase.from('catalog_requests').select('id').limit(1)
  if (err6) console.log('catalog_requests table missing/error:', err6.message)
  else console.log('catalog_requests table exists!')

  // 7. settings.b2b_catalog_requests column check
  const { error: err7 } = await supabase.from('settings').select('b2b_catalog_requests').eq('id', 'main').maybeSingle()
  if (err7) console.log('settings.b2b_catalog_requests column missing:', err7.message)
  else console.log('settings.b2b_catalog_requests column exists!')

  if (err4 || err5) {
    console.log('\n⚠ Some customer login tracking tables/columns are missing.')
    console.log('  Run the SQL in schema-customer-logins.sql via Supabase Dashboard → SQL Editor.')
  }
  if (err6 || err7) {
    console.log('\n⚠ Some catalog request tracking tables/columns are missing.')
    console.log('  Run the SQL in schema-catalog-requests.sql via Supabase Dashboard → SQL Editor.')
  }
}

run()
