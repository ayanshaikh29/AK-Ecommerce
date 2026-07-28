import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

const hkDir = 'c:\\Users\\HP\\Desktop\\Portfolios Ayan\\E-COMMERCE WEB\\extracted_hk'
const statDir = 'c:\\Users\\HP\\Desktop\\Portfolios Ayan\\E-COMMERCE WEB\\extracted_stationery'

function findFileByKeyword(dir, keyword) {
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir, { recursive: true })
  for (const f of files) {
    if (f.toLowerCase().includes(keyword.toLowerCase())) {
      return path.join(dir, f)
    }
  }
  return null
}

async function run() {
  const filePath = findFileByKeyword(statDir, 'sketch')
  if (filePath) {
    console.log(`Found sketch file: ${filePath}`)
    const fileBuf = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const storageFilename = `demo-visual-${Date.now()}-${Math.floor(Math.random()*1000)}${ext}`
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'

    const { error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(storageFilename, fileBuf, { contentType: mimeType, upsert: true })

    if (!uploadErr) {
      const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(storageFilename)
      console.log('UPLOADED_FIFTH:', pubData.publicUrl)
    }
  }
}
run()
