import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Parse .env file
const envPath = path.resolve('.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const value = parts.slice(1).join('=').trim()
    env[key] = value
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://xgxqremmwxnwplhpvtux.supabase.co'
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// Directory paths
const hkDir = 'c:\\Users\\HP\\Desktop\\Portfolios Ayan\\E-COMMERCE WEB\\extracted_hk'
const stationeryDir = 'c:\\Users\\HP\\Desktop\\Portfolios Ayan\\E-COMMERCE WEB\\extracted_stationery'

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList)
    } else {
      const ext = path.extname(file).toLowerCase()
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        fileList.push({ name: file, path: filePath, ext })
      }
    }
  }
  return fileList
}

function cleanStr(s) {
  return (s || '').toLowerCase()
    .replace(/\s*-\s*copy|\(\d+\)/gi, '')
    .replace(/[^a-z0-9]/g, '')
}

async function run() {
  const { data: products } = await supabase.from('products').select('id, name, slug')
  const { data: storeRow } = await supabase.from('settings').select('b2b_products').eq('id', 'main').maybeSingle()
  const storeProducts = storeRow?.b2b_products || []
  const allProducts = Array.isArray(products) && products.length > 0 ? products : storeProducts

  const localFiles = [...getAllFiles(hkDir), ...getAllFiles(stationeryDir)]
  console.log(`Analyzing ${allProducts.length} products against ${localFiles.length} extracted files...`)

  const matchedResults = []
  const unmatchedProducts = []

  for (const prod of allProducts) {
    const pName = prod.name || prod.title || ''
    const pClean = cleanStr(pName)

    // Find strict high-confidence match
    let match = null

    for (const f of localFiles) {
      const fBase = path.basename(f.name, f.ext)
      const fClean = cleanStr(fBase)

      // Strict inclusion check: if both cleaned strings overlap significantly or match key unique tokens
      if (fClean.length >= 4 && pClean.length >= 4) {
        if (pClean.includes(fClean) || fClean.includes(pClean)) {
          match = f
          break
        }
      }
    }

    if (match) {
      matchedResults.push({ prod, pName, file: match })
    } else {
      unmatchedProducts.push({ prod, pName })
    }
  }

  console.log(`\nSTRICT MATCHES FOUND: ${matchedResults.length}`)
  matchedResults.forEach((m, i) => {
    console.log(`${i+1}. [${m.pName}] ===> [${m.file.name}]`)
  })

  console.log(`\nUNMATCHED PRODUCTS (to use /placeholder.png): ${unmatchedProducts.length}`)
  unmatchedProducts.forEach((u, i) => {
    console.log(`${i+1}. [${u.pName}]`)
  })

  // Upload strictly matched photos to Supabase Storage & database
  console.log('\nUploading strictly matched photos to Supabase Storage...')

  for (const m of matchedResults) {
    const fileBuf = fs.readFileSync(m.file.path)
    const safeSlug = (m.prod.slug || m.pName).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const filename = `strict-${safeSlug}-${Date.now()}${m.file.ext}`
    const mimeType = m.file.ext === '.png' ? 'image/png' : m.file.ext === '.webp' ? 'image/webp' : 'image/jpeg'

    const { error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(filename, fileBuf, { contentType: mimeType, upsert: true })

    if (uploadErr) {
      console.error(`Upload error for ${m.pName}:`, uploadErr.message)
      continue
    }

    const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(filename)
    const publicUrl = pubData.publicUrl

    // Update product_images table
    await supabase.from('product_images').delete().eq('product_id', m.prod.id)
    await supabase.from('product_images').insert({
      id: uuidv4(),
      product_id: m.prod.id,
      image_url: publicUrl,
      sort_order: 0,
      is_primary: true,
      created_at: new Date().toISOString()
    })

    // Update products table images array column
    await supabase.from('products').update({
      images: [publicUrl],
      updated_at: new Date().toISOString()
    }).eq('id', m.prod.id)

    // Sync JSON store if applicable
    if (storeProducts.length > 0) {
      const idx = storeProducts.findIndex(sp => sp.id === m.prod.id)
      if (idx !== -1) {
        storeProducts[idx].images = [publicUrl]
        storeProducts[idx].image_url = publicUrl
      }
    }
  }

  // Clear un-matched products to use clean /placeholder.png
  for (const u of unmatchedProducts) {
    await supabase.from('product_images').delete().eq('product_id', u.prod.id)
    await supabase.from('products').update({
      images: ['/placeholder.png'],
      updated_at: new Date().toISOString()
    }).eq('id', u.prod.id)

    if (storeProducts.length > 0) {
      const idx = storeProducts.findIndex(sp => sp.id === u.prod.id)
      if (idx !== -1) {
        storeProducts[idx].images = ['/placeholder.png']
        storeProducts[idx].image_url = '/placeholder.png'
      }
    }
  }

  if (storeProducts.length > 0) {
    await supabase.from('settings').upsert({ id: 'main', b2b_products: storeProducts, updated_at: new Date().toISOString() })
  }

  console.log('\nStrict photo matching and database update completed successfully!')
}

run()
