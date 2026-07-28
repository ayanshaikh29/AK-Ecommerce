import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const env = {}
for (const line of readFileSync(path.resolve('.env'), 'utf-8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i === -1) continue
  env[t.slice(0,i).trim()] = t.slice(i+1).trim().replace(/^['"]|['"]$/g,'')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function run() {
  const catId = (await supabase.from('categories').select('id').limit(1)).data?.[0]?.id
  if (!catId) { console.log('No category found'); return }
  const now = new Date().toISOString()
  const id = uuidv4()
  const { data, error } = await supabase.from('products').insert({
    id, name: 'Test', slug: 'test', price: 100, mrp: 150,
    category_id: catId, stock_quantity: 10, sku: 'TEST',
    is_active: true, created_at: now, updated_at: now
  }).select()
  console.log('Error:', error?.message || 'OK')
  if (data?.[0]) {
    console.log('Columns:', Object.keys(data[0]).join(', '))
    console.log('Has images:', 'images' in data[0])
    console.log('Has brand:', 'brand' in data[0])
    console.log('Has description:', 'description' in data[0])
    console.log('Has subcategory:', 'subcategory' in data[0])
    console.log('Has discount_percent:', 'discount_percent' in data[0])
    console.log('Has rating_avg:', 'rating_avg' in data[0])
    console.log('Has is_featured:', 'is_featured' in data[0])
    await supabase.from('products').delete().eq('id', id)
  }
}
run().catch(e => console.error(e))
