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

async function testPricingManager() {
  console.log('=== TESTING CUSTOMER PRICING DATA ===\n')

  // 1. Get first customer user
  const { data: users } = await supabase.from('users').select('*').eq('role', 'customer').limit(1)
  const cust = users?.[0]
  console.log('Customer:', cust?.id, cust?.full_name, cust?.email)

  if (!cust) return

  // 2. Query /api/admin/customer-pricing?customer_id=...
  const adminRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@store.com', password: 'Admin@123' })
  })
  const adminData = await adminRes.json()

  const res = await fetch(`http://localhost:3000/api/admin/customer-pricing?customer_id=${cust.id}`, {
    headers: { Authorization: `Bearer ${adminData.token}` }
  })

  console.log('Customer Pricing API Status:', res.status)
  const pricingData = await res.json()
  console.log('Products Count:', pricingData?.products?.length)

  if (pricingData?.products?.length > 0) {
    const sample = pricingData.products[0]
    console.log('Sample product:', {
      product_id: sample.product_id,
      product_name: sample.product_name,
      custom_price: sample.custom_price,
      is_visible: sample.is_visible,
      type_custom_price: typeof sample.custom_price,
      type_is_visible: typeof sample.is_visible
    })
  }
}

testPricingManager()
