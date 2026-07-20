import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const envPath = path.resolve('.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
  env[key] = val
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').replace(/^-+/, '')
}

async function run() {
  const now = new Date().toISOString()
  const uploadedCache = {}
  
  // 1. Seed categories (without 'description' or 'icon' columns as they don't exist in DB)
  console.log('Clearing and seeding categories...')
  const catsToInsert = [
    { id: uuidv4(), name: 'Office Stationery', slug: 'office-stationery', image_url: 'https://images.unsplash.com/photo-1568871391150-ff6047a2ff10?w=800&q=80', created_at: now },
    { id: uuidv4(), name: 'Housekeeping', slug: 'housekeeping', image_url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&q=80', created_at: now },
    { id: uuidv4(), name: 'UPS Solutions', slug: 'ups-solutions', image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80', created_at: now },
  ]
  
  await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { error: catErr } = await supabase.from('categories').insert(catsToInsert)
  if (catErr) {
    console.error('Failed to seed categories:', catErr)
    process.exit(1)
  }
  console.log('Categories seeded.')

  // Map category slugs to ids
  const catMap = Object.fromEntries(catsToInsert.map(c => [c.slug, c.id]))
  
  // 2. Read products from seeded-data.json
  const dataPath = path.join(process.cwd(), 'scripts', 'seeded-data.json')
  if (!existsSync(dataPath)) {
    console.error('seeded-data.json not found! Run the python optimize-images.py script first.')
    process.exit(1)
  }
  
  const products = JSON.parse(readFileSync(dataPath, 'utf-8'))
  console.log(`Loaded ${products.length} products from seeded-data.json.`)
  
  // 3. Clear existing products and product_images
  console.log('Clearing product_images and products tables...')
  await supabase.from('product_images').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  // 4. Insert products and their images
  console.log('Inserting products...')
  for (const p of products) {
    const pId = uuidv4()
    const pSlug = slugify(p.name)
    const isStationery = p.category_slug === 'office-stationery'
    
    const disc = p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0
    const skuCode = (isStationery ? 'AK-ST-' : 'AK-HK-') + Math.floor(Math.random() * 90000 + 10000)
    
    // Generate random rating
    const ratingAvg = +(4.0 + Math.random() * 0.9).toFixed(1)
    const ratingCount = Math.floor(5 + Math.random() * 40)
    
    const prodDoc = {
      id: pId,
      name: p.name,
      slug: pSlug,
      description: p.description,
      price: p.price,
      mrp: p.mrp,
      discount_percent: disc,
      category_id: catMap[p.category_slug],
      stock_quantity: 100,
      sku: skuCode,
      is_active: true,
      is_featured: p.featured,
      rating_avg: ratingAvg,
      rating_count: ratingCount,
      created_at: now,
      updated_at: now
    }
    
    const { error: prodErr } = await supabase.from('products').insert(prodDoc)
    if (prodErr) {
      console.error(`Failed to insert product "${p.name}":`, prodErr)
      continue
    }
    
    // Insert image
    let imageUrl = p.image_url
    if (imageUrl && imageUrl.startsWith('/uploads/')) {
      const filename = imageUrl.replace('/uploads/', '')
      if (uploadedCache[filename]) {
        imageUrl = uploadedCache[filename]
      } else {
        const fullPath = path.join(process.cwd(), 'public', 'uploads', filename)
        if (existsSync(fullPath)) {
          const buf = readFileSync(fullPath)
          const ext = filename.split('.').pop() || 'bin'
          const storageFilename = `${uuidv4()}.${ext}`
          
          const contentTypeMap = {
            webp: 'image/webp',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
          }
          
          const { error: uploadErr } = await supabase.storage
            .from('product-images')
            .upload(storageFilename, buf, {
              contentType: contentTypeMap[ext] || `image/${ext}`,
              cacheControl: '31536000'
            })
            
          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage
              .from('product-images')
              .getPublicUrl(storageFilename)
            uploadedCache[filename] = publicUrl
            imageUrl = publicUrl
            console.log(`Uploaded local ${filename} to Supabase Storage: ${publicUrl}`)
          } else {
            console.error(`Failed to upload local image ${filename}:`, uploadErr.message)
          }
        } else {
          console.warn(`Local file ${filename} not found in public/uploads`)
        }
      }
    }

    const imgDoc = {
      id: uuidv4(),
      product_id: pId,
      image_url: imageUrl,
      sort_order: 0,
      created_at: now
    }
    
    const { error: imgErr } = await supabase.from('product_images').insert(imgDoc)
    if (imgErr) {
      console.error(`Failed to insert image for product "${p.name}":`, imgErr)
    } else {
      console.log(`✓ Inserted product and image: ${p.name}`)
    }
  }
  
  console.log('\nAll products re-seeded successfully!')
}

run().catch(err => {
  console.error('Reseed failed:', err)
  process.exit(1)
})
