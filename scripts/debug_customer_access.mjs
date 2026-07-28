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

async function debugAccess() {
  console.log('=== DEBUGGING CUSTOMER ACCESS ===\n')

  // 1. Get user record for ayanshaikh17653@gmail.com
  const { data: userRow } = await supabase.from('users').select('*').eq('email', 'ayanshaikh17653@gmail.com').maybeSingle()
  console.log('User DB record:', userRow)

  if (!userRow) return

  // 2. Query customer_product_pricing table for userRow.id
  const { data: tablePricing } = await supabase.from('customer_product_pricing').select('*').eq('customer_id', userRow.id)
  console.log(`\nTable pricing for customer_id ${userRow.id}:`, tablePricing)

  // 3. Query all customer_product_pricing rows
  const { data: allTablePricing } = await supabase.from('customer_product_pricing').select('*')
  console.log(`\nALL customer_product_pricing rows (${allTablePricing?.length}):`, allTablePricing)

  // 4. Query settings b2b_customer_pricing
  const { data: store } = await supabase.from('settings').select('b2b_customer_pricing').eq('id', 'main').maybeSingle()
  console.log(`\nJSON store b2b_customer_pricing entries (${store?.b2b_customer_pricing?.length || 0}):`, store?.b2b_customer_pricing)
}

debugAccess()
