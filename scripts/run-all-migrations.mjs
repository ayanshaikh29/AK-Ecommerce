import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'

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

function hashPw(pw) {
  const secret = env.AUTH_SECRET || 'dev-secret'
  return crypto.createHmac('sha256', secret).update(pw).digest('hex')
}

async function run() {
  console.log('=== B2B Database Verification ===\n')

  // 1. Verify tables exist and report which SQL files to run
  console.log('Checking required tables & columns:')
  const checks = [
    { name: 'customer_product_pricing (schema-b2b.sql)', query: () => supabase.from('customer_product_pricing').select('id').limit(1) },
    { name: 'stock_movements (schema-b2b.sql)', query: () => supabase.from('stock_movements').select('id').limit(1) },
    { name: 'vendors (schema-b2b.sql)', query: () => supabase.from('vendors').select('id').limit(1) },
    { name: 'customer_logins (schema-customer-logins.sql)', query: () => supabase.from('customer_logins').select('id').limit(1) },
    { name: 'catalog_requests (schema-catalog-requests.sql)', query: () => supabase.from('catalog_requests').select('id').limit(1) },
    { name: 'settings.b2b_catalog_requests (schema-catalog-requests.sql)', query: () => supabase.from('settings').select('b2b_catalog_requests').eq('id', 'main').maybeSingle() },
  ]

  const missing = []
  for (const c of checks) {
    const { error } = await c.query()
    if (error) {
      console.log(`   ❌ ${c.name}: ${error.message}`)
      missing.push(c.name.split('(')[0].trim())
    } else {
      console.log(`   ✅ ${c.name}`)
    }
  }

  if (missing.length > 0) {
    console.log('\n⚠ Missing tables/columns detected!')
    console.log('   Run these SQL files in Supabase Dashboard → SQL Editor:')
    if (missing.some(m => m.includes('customer_product_pricing') || m.includes('stock_movements') || m.includes('vendors')))
      console.log('   1. schema-b2b.sql  (customer_product_pricing, stock_movements, vendors)')
    if (missing.some(m => m.includes('customer_logins')))
      console.log('   2. schema-customer-logins.sql  (customer_logins table)')
    if (missing.some(m => m.includes('catalog_requests')))
      console.log('   3. schema-catalog-requests.sql  (catalog_requests table + settings column)')
  }

  // 2. Check/create customer account
  console.log('\n--- Customer Account ---')
  const { data: existingUser } = await supabase.from('users').select('id, email').eq('email', 'ayanshaikh17653@gmail.com').maybeSingle()
  if (existingUser) {
    console.log(`✅ Customer exists: ${existingUser.email} (id: ${existingUser.id})`)
  } else {
    console.log('❌ Customer ayanshaikh17653@gmail.com NOT found in users table')
    console.log('   Creating account...')
    const now = new Date().toISOString()
    const newId = uuidv4()
    const { error: uErr } = await supabase.from('users').insert({
      id: newId,
      email: 'ayanshaikh17653@gmail.com',
      password: hashPw('Ayan@123'),
      full_name: 'Ayan Shaikh',
      phone: '+91 12345 67890',
      role: 'customer',
      created_at: now
    })
    if (uErr) {
      console.log(`   ❌ Failed: ${uErr.message}`)
      console.log('   You can also register manually via the signup page.')
    } else {
      console.log(`   ✅ Customer created!`)
      console.log(`      Email: ayanshaikh17653@gmail.com`)
      console.log(`      Password: Ayan@123`)
      console.log('   (Log out and log back in with these credentials)')
    }
  }

  console.log('\n=== Done ===')
}

run().catch(e => console.error('Fatal:', e))
