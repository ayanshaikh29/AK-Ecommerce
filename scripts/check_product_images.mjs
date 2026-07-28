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

async function checkProductImages() {
  const { data: products } = await supabase.from('products').select('id, name, images')
  for (const p of products || []) {
    console.log(`Product: ${p.name}`)
    console.log(`  Images:`, p.images)
  }
}

checkProductImages()
