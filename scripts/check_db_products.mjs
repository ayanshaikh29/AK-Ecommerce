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

async function checkProducts() {
  const { data: products, error } = await supabase
    .from('products')
    .select('*, product_images(*), categories(name, slug)')

  if (error) {
    console.error('Error fetching products:', error)
    return
  }

  console.log(`Total products in database: ${products.length}`)
  products.forEach((p, idx) => {
    console.log(`${idx + 1}. [${p.categories?.name || 'No Category'}] ${p.name}`)
    console.log(`   images array:`, p.images)
    console.log(`   product_images relation:`, p.product_images)
  })
}

checkProducts()
