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

console.log(`Connecting to Supabase at: ${supabaseUrl}`)
const supabase = createClient(supabaseUrl, supabaseKey)

// Directory paths for extracted product photos
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
      if (['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext)) {
        fileList.push({ name: file, path: filePath, ext })
      }
    }
  }
  return fileList
}

function cleanString(str) {
  return (str || '').toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function run() {
  console.log('Fetching products from Supabase table...')
  const { data: products, error: prodErr } = await supabase.from('products').select('id, name, slug')
  
  if (prodErr) {
    console.error('Error fetching products from table:', prodErr)
  }

  // Also check settings JSON store
  const { data: storeRow } = await supabase.from('settings').select('b2b_products').eq('id', 'main').maybeSingle()
  const storeProducts = storeRow?.b2b_products || []

  // Combine products list
  const allProducts = Array.isArray(products) && products.length > 0 ? products : storeProducts

  console.log(`Found ${allProducts.length} total products. Gathering local image files...`)
  const allImages = [...getAllFiles(hkDir), ...getAllFiles(stationeryDir)]
  console.log(`Found ${allImages.length} local extracted image files in archives.`)

  const updatedProducts = []
  const skippedProducts = []

  for (const product of allProducts) {
    const pName = product.name || product.title || ''
    const cleanProdName = cleanString(pName)
    const prodWords = cleanProdName.split(' ').filter(w => w.length >= 3)

    // Find best matching image file
    let bestMatch = null
    let highestScore = 0

    for (const img of allImages) {
      const cleanImgName = cleanString(path.basename(img.name, img.ext))
      
      // Exact containment check
      if (cleanImgName.includes(cleanProdName) || cleanProdName.includes(cleanImgName)) {
        bestMatch = img
        highestScore = 100
        break
      }

      // Word matching score
      const imgWords = cleanImgName.split(' ').filter(w => w.length >= 3)
      let score = 0
      for (const pw of prodWords) {
        if (imgWords.some(iw => iw.includes(pw) || pw.includes(iw))) {
          score += 1
        }
      }

      if (score > highestScore && score >= 1) {
        highestScore = score
        bestMatch = img
      }
    }

    if (bestMatch) {
      console.log(`Match: [${pName}] -> File: [${bestMatch.name}]`)
      try {
        const fileBuf = fs.readFileSync(bestMatch.path)
        const safeSlug = (product.slug || pName).toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const filename = `product-${safeSlug}-${Date.now()}${bestMatch.ext}`
        const mimeType = bestMatch.ext === '.png' ? 'image/png' : bestMatch.ext === '.webp' ? 'image/webp' : 'image/jpeg'

        // Upload to Supabase Storage bucket 'product-images'
        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(filename, fileBuf, { contentType: mimeType, upsert: true })

        if (uploadErr) {
          console.error(`Storage upload error for ${pName}:`, uploadErr.message)
          skippedProducts.push({ name: pName, reason: 'Upload error: ' + uploadErr.message })
          continue
        }

        const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(filename)
        const publicUrl = pubData.publicUrl

        // Delete existing and Insert into product_images table
        await supabase.from('product_images').delete().eq('product_id', product.id)
        await supabase.from('product_images').insert({
          id: uuidv4(),
          product_id: product.id,
          image_url: publicUrl,
          sort_order: 0,
          is_primary: true,
          created_at: new Date().toISOString()
        })

        // Also update settings JSON store if applicable
        if (storeProducts.length > 0) {
          const idx = storeProducts.findIndex(p => p.id === product.id)
          if (idx !== -1) {
            storeProducts[idx].images = [publicUrl]
            storeProducts[idx].image_url = publicUrl
          }
        }

        updatedProducts.push({ name: pName, image_url: publicUrl, matchedFile: bestMatch.name })
      } catch (err) {
        console.error(`Failed processing ${pName}:`, err.message)
        skippedProducts.push({ name: pName, reason: err.message })
      }
    } else {
      skippedProducts.push({ name: pName, reason: 'No matching photo file found in Hk/stationary archives' })
    }
  }

  // Sync back JSON store if used
  if (storeProducts.length > 0) {
    await supabase.from('settings').upsert({ id: 'main', b2b_products: storeProducts, updated_at: new Date().toISOString() })
  }

  console.log('\n================ VERIFICATION & ACCURACY REPORT ================')
  console.log(`Successfully uploaded & updated ${updatedProducts.length} product photos in Supabase Storage!`)
  if (skippedProducts.length > 0) {
    console.log(`\nProducts STILL needing manual image uploads (${skippedProducts.length}):`)
    skippedProducts.forEach((p, idx) => console.log(`${idx + 1}. ${p.name} — ${p.reason}`))
  } else {
    console.log('\nAll products in the database now have real product photos!')
  }
  console.log('=================================================================\n')
}

run()
