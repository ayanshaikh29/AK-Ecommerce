import { readFileSync } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const env = {}
for (const line of readFileSync(path.resolve('.env'), 'utf-8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i === -1) continue
  env[t.slice(0,i).trim()] = t.slice(i+1).trim().replace(/^['"]|['"]$/g,'')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const products = JSON.parse(readFileSync(path.resolve('scripts/seeded-data.json'), 'utf-8'))

async function run() {
  console.log('=== Restoring Products ===\n')

  // 1. Categories
  console.log('1. Ensuring categories...')
  const { data: existingCats } = await supabase.from('categories').select('id, slug')
  const catMap = {}
  for (const c of (existingCats || [])) catMap[c.slug] = c.id

  const neededCats = [
    { slug: 'housekeeping', name: 'Housekeeping' },
    { slug: 'office-stationery', name: 'Office Stationery' },
  ]
  for (const cat of neededCats) {
    if (!catMap[cat.slug]) {
      const id = uuidv4()
      const { error } = await supabase.from('categories').insert({
        id, name: cat.name, slug: cat.slug, created_at: new Date().toISOString()
      })
      if (error) console.log(`   Failed ${cat.slug}: ${error.message}`)
      else { catMap[cat.slug] = id; console.log(`   Created: ${cat.name}`) }
    } else {
      console.log(`   Exists: ${cat.name}`)
    }
  }

  // 2. Insert products
  console.log('\n2. Inserting products...')
  const now = new Date().toISOString()
  const batchSize = 20
  let inserted = 0

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize).map(p => ({
      id: uuidv4(),
      name: p.name,
      slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
      description: p.description || '',
      price: p.price,
      mrp: p.mrp,
      discount_percent: Math.round((1 - p.price / p.mrp) * 100),
      category_id: catMap[p.category_slug],
      stock_quantity: 100,
      sku: 'AK-' + Math.floor(Math.random() * 90000 + 10000),
      is_active: true,
      is_featured: p.featured || false,
      rating_avg: 4.5,
      rating_count: 20,
      created_at: now,
      updated_at: now
    }))
    const { error } = await supabase.from('products').insert(batch)
    if (error) console.log(`   Batch ${i / batchSize + 1} FAILED: ${error.message}`)
    else { inserted += batch.length; console.log(`   Batch ${i / batchSize + 1}: ${batch.length} OK`) }
  }

  console.log(`\n✅ ${inserted}/${products.length} products restored`)
  console.log('Refresh the app to see them.')
  console.log('\n⚠ Images and brand info missing until you run the ALTER TABLE SQL (see above).')
}

run().catch(e => console.error('Fatal:', e))
