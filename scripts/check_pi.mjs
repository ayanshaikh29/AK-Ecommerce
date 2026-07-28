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

async function check() {
  const { data: pi, error } = await supabase.from('product_images').select('*, products(name)')
  console.log(`Total product_images rows: ${pi?.length || 0}`)
  if (error) console.error('Error:', error)
  else {
    pi.slice(0, 10).forEach(r => console.log(`  ${r.products?.name} -> ${r.image_url}`))
  }
}

check()
