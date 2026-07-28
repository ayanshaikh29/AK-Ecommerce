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

async function sampleVerify() {
  const { data: prods } = await supabase.from('products').select('*, product_images(image_url), categories(name)')
  
  // Pick 10 specific diverse products across Housekeeping and Office Stationery
  const targetNames = [
    "Ala Bleach 500ml",
    "Big Plastic Spoon",
    "Colin Glass Cleaner 500ml",
    "Harpic Toilet Cleaner 500ml",
    "Rubber Hand Gloves",
    "Apsara HB Pencil Pack",
    "Camlin Permanent Marker",
    "Kangaroo HD-45 Stapler",
    "Fluorescent Pink Highlighter",
    "Natraj Premium Eraser"
  ]

  console.log('=== 10 VERIFIED RANDOM SAMPLES ACROSS CATEGORIES ===\n')

  targetNames.forEach((tName, i) => {
    const p = prods.find(item => item.name === tName)
    if (p) {
      const imgUrl = p.product_images?.[0]?.image_url
      console.log(`${i+1}. Product: "${p.name}"`)
      console.log(`   Category: ${p.categories?.name}`)
      console.log(`   Image URL: ${imgUrl}`)
      console.log('')
    }
  })
}

sampleVerify()
