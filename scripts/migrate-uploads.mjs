import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, readdirSync } from 'fs'
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

const UPLOADS_DIR = path.resolve('public', 'uploads')

async function run() {
  console.log('Creating product-images bucket if needed...')
  const { data: bucket, error: bucketErr } = await supabase.storage.createBucket('product-images', { public: true })
  if (bucketErr && !bucketErr.message?.includes('already exists')) {
    console.error('Bucket creation error:', bucketErr)
    process.exit(1)
  }
  console.log('Bucket ready.')

  const { data: images, error: imgErr } = await supabase
    .from('product_images')
    .select('id, image_url')
    .ilike('image_url', '/uploads/%')

  if (imgErr) {
    console.error('Failed to fetch product_images:', imgErr)
    process.exit(1)
  }

  if (!images || images.length === 0) {
    console.log('No product images with local /uploads/ paths found in database. Nothing to migrate.')
    return
  }

  console.log(`Found ${images.length} product image(s) with local /uploads/ paths.`)

  const localFiles = {}
  try {
    const files = readdirSync(UPLOADS_DIR)
    for (const f of files) {
      localFiles[f.toLowerCase()] = f
    }
  } catch (e) {
    console.warn('Could not read local uploads directory:', e.message)
  }

  let migrated = 0
  let skipped = 0

  for (const img of images) {
    const localPath = img.image_url.replace('/uploads/', '')
    const localFile = localFiles[localPath.toLowerCase()]

    if (!localFile) {
      console.warn(`SKIPPED: Local file not found for "${img.image_url}"`)
      skipped++
      continue
    }

    const fullPath = path.join(UPLOADS_DIR, localFile)
    const buf = readFileSync(fullPath)
    const ext = localFile.split('.').pop() || 'bin'
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

    if (uploadErr) {
      console.error(`FAILED to upload "${localFile}":`, uploadErr.message)
      skipped++
      continue
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(storageFilename)

    const { error: updateErr } = await supabase
      .from('product_images')
      .update({ image_url: publicUrl })
      .eq('id', img.id)

    if (updateErr) {
      console.error(`FAILED to update DB for "${img.image_url}":`, updateErr.message)
      skipped++
    } else {
      console.log(`MIGRATED: ${img.image_url} -> ${publicUrl}`)
      migrated++
    }
  }

  console.log(`\nDone. ${migrated} migrated, ${skipped} skipped/failed.`)
  if (skipped > 0) {
    console.log(`The skipped products need manual re-upload through the admin panel.`)
  }
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
