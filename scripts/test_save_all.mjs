import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

try {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=')
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
  })
} catch (e) {}

const BASE_URL = 'http://localhost:3000'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function testSaveAllBatch() {
  console.log('=== TESTING BULK BATCH SAVE ALL ENDPOINT ===\n')

  // Get user ayanshaikh17653@gmail.com
  const { data: userRow } = await supabase.from('users').select('*').eq('email', 'ayanshaikh17653@gmail.com').maybeSingle()
  const { data: prods } = await supabase.from('products').select('id, name').limit(3)

  if (!userRow || !prods || prods.length < 3) {
    console.error('Test user or products missing')
    return
  }

  const batchUpdates = [
    { customer_id: userRow.id, product_id: prods[0].id, custom_price: 75, is_visible: true },
    { customer_id: userRow.id, product_id: prods[1].id, custom_price: 90, is_visible: true },
    { customer_id: userRow.id, product_id: prods[2].id, custom_price: 200, is_visible: true }
  ]

  // Sign in as admin to get token
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@store.com', password: 'Admin@123' })
  })

  const adminData = await adminRes.json()

  // Post batch_updates
  const batchRes = await fetch(`${BASE_URL}/api/admin/customer-pricing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminData.token}`
    },
    body: JSON.stringify({ batch_updates: batchUpdates })
  })

  console.log('Batch Save Status:', batchRes.status)
  const batchResult = await batchRes.json()
  console.log('Batch Save Result:', batchResult)
}

testSaveAllBatch()
