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

async function checkReferences(oldId, email) {
  console.log(`\n--- Checking references for ${email} (old db_id: ${oldId}) ---`)
  
  const tables = [
    { table: 'users', col: 'id' },
    { table: 'users', col: 'referred_by_id' },
    { table: 'profiles', col: 'id' },
    { table: 'orders', col: 'user_id' },
    { table: 'addresses', col: 'user_id' },
    { table: 'customer_product_pricing', col: 'customer_id' },
    { table: 'customer_product_pricing', col: 'user_id' },
    { table: 'customer_logins', col: 'user_id' },
    { table: 'catalog_requests', col: 'user_id' },
    { table: 'wishlist', col: 'user_id' },
    { table: 'reviews', col: 'user_id' },
    { table: 'vendors', col: 'user_id' },
    { table: 'stock_movements', col: 'created_by_id' },
    { table: 'stock_movements', col: 'user_id' }
  ]

  for (const { table, col } of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq(col, oldId)
      if (error) {
        // Table or column might not exist, ignore
        continue
      }
      if (data && data.length > 0) {
        console.log(`  Found ${data.length} rows in ${table}.${col}`)
      }
    } catch (e) {}
  }
}

async function main() {
  await checkReferences('972f1447-2589-42e9-af1e-f2c6a9d45247', 'admin@store.com')
  await checkReferences('75f513ea-3cf0-40f1-b801-8bd09953ce75', 'ayanshaikh17653@gmail.com')
}

main()
