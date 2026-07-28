import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import crypto from 'crypto'

try {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=')
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
  })
} catch (e) {}

const SECRET = process.env.AUTH_SECRET || 'lumiere-supersecret-change-me-2025'
function hashPw(pw) { return crypto.createHmac('sha256', SECRET).update(pw).digest('hex') }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  console.log('Inserting admin@store.com with ID afd4a544-c12e-4622-a13f-8b07829f72f2...')
  const now = new Date().toISOString()
  
  const { error: adminErr } = await supabase.from('users').insert({
    id: 'afd4a544-c12e-4622-a13f-8b07829f72f2',
    email: 'admin@store.com',
    password: hashPw('Admin@123'),
    full_name: 'AK Admin',
    phone: '+91 83088 60894',
    role: 'admin',
    created_at: now
  })
  if (adminErr) console.error('Admin insert error:', adminErr)
  else console.log('Admin inserted successfully!')

  await supabase.from('profiles').upsert({
    id: 'afd4a544-c12e-4622-a13f-8b07829f72f2',
    full_name: 'AK Admin',
    phone: '+91 83088 60894',
    role: 'admin',
    updated_at: now
  })

  console.log('Inserting ayanshaikh17653@gmail.com with ID 100153e5-52da-438b-8f5a-12c3734a9088...')
  const { error: customerErr } = await supabase.from('users').insert({
    id: '100153e5-52da-438b-8f5a-12c3734a9088',
    email: 'ayanshaikh17653@gmail.com',
    password: hashPw('Password@123'),
    full_name: 'Ayan Shaikh',
    phone: '',
    role: 'customer',
    created_at: now
  })
  if (customerErr) console.error('Customer insert error:', customerErr)
  else console.log('Customer inserted successfully!')

  await supabase.from('profiles').upsert({
    id: '100153e5-52da-438b-8f5a-12c3734a9088',
    full_name: 'Ayan Shaikh',
    phone: '',
    role: 'customer',
    updated_at: now
  })

  // Update customer_product_pricing customer_id to 100153e5-52da-438b-8f5a-12c3734a9088
  console.log('Updating customer_product_pricing for old id 75f513ea-3cf0-40f1-b801-8bd09953ce75 -> 100153e5-52da-438b-8f5a-12c3734a9088...')
  const { error: pricingErr } = await supabase.from('customer_product_pricing')
    .update({ customer_id: '100153e5-52da-438b-8f5a-12c3734a9088' })
    .eq('customer_id', '75f513ea-3cf0-40f1-b801-8bd09953ce75')
  if (pricingErr) console.error('Pricing update error:', pricingErr)
  else console.log('Pricing updated successfully!')
}

main()
