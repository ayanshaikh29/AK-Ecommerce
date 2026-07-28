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

async function debugCatalogRequests() {
  console.log('=== DEBUGGING CATALOG REQUESTS ===\n')

  // 1. Direct Supabase Query on catalog_requests table
  const { data: dbReqs, error: dbErr } = await supabase.from('catalog_requests').select('*')
  console.log('Direct DB query on catalog_requests table:')
  console.log('Error:', dbErr)
  console.log('Data:', dbReqs)

  // 2. Direct Supabase Query on settings b2b_catalog_requests
  const { data: setReqs } = await supabase.from('settings').select('b2b_catalog_requests').eq('id', 'main').maybeSingle()
  console.log('\nSettings b2b_catalog_requests:', setReqs?.b2b_catalog_requests)

  // 3. Login as test customer ayanshaikh17653@gmail.com
  const custRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ayanshaikh17653@gmail.com', password: 'Password@123' })
  })

  const custData = await custRes.json()
  console.log('\nCustomer login status:', custRes.status, 'Token exists:', !!custData.token)

  // 4. Post catalog request as customer
  const postRes = await fetch(`${BASE_URL}/api/catalog-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custData.token}`
    },
    body: JSON.stringify({ note: 'Test catalog access request from debug script' })
  })

  console.log('POST /api/catalog-requests status:', postRes.status)
  const postResult = await postRes.json()
  console.log('POST Result:', postResult)

  // 5. Login as Admin & Fetch GET /api/admin/catalog-requests
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@store.com', password: 'Admin@123' })
  })
  const adminData = await adminRes.json()

  const getRes = await fetch(`${BASE_URL}/api/admin/catalog-requests`, {
    headers: { Authorization: `Bearer ${adminData.token}` }
  })

  console.log('\nGET /api/admin/catalog-requests status:', getRes.status)
  const getResult = await getRes.json()
  console.log('GET Result:', getResult)
}

debugCatalogRequests()
