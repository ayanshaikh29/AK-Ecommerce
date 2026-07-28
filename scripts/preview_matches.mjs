import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

const hkDir = path.join(process.cwd(), 'Hk folder', 'Hk folder')
const statDir = path.join(process.cwd(), 'stationary', 'stationary')
const uploadsDir = path.join(process.cwd(), 'public', 'uploads')

const hkFiles = fs.existsSync(hkDir) ? fs.readdirSync(hkDir) : []
const statFiles = fs.existsSync(statDir) ? fs.readdirSync(statDir) : []
const uploadsFiles = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : []

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findBestMatch(productName, isStationery) {
  const sourceFiles = isStationery ? statFiles : hkFiles
  const normName = normalize(productName)

  // 1. Try matching in direct source directory
  for (const f of sourceFiles) {
    const normF = normalize(f.split('.')[0])
    if (normF === normName || normF.includes(normName) || normName.includes(normF)) {
      return { file: f, folder: isStationery ? 'stationary/stationary' : 'Hk folder/Hk folder', path: path.join(isStationery ? statDir : hkDir, f) }
    }
  }

  // 2. Fuzzy token match in source directory
  const tokens = productName.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  let best = null
  let maxScore = 0

  for (const f of sourceFiles) {
    const normF = normalize(f.split('.')[0])
    let score = 0
    tokens.forEach(t => {
      if (normF.includes(normalize(t))) score++
    })
    if (score > maxScore) {
      maxScore = score
      best = { file: f, folder: isStationery ? 'stationary/stationary' : 'Hk folder/Hk folder', path: path.join(isStationery ? statDir : hkDir, f), score }
    }
  }

  if (best && maxScore >= Math.min(2, tokens.length)) {
    return best
  }

  // 3. Try matching in public/uploads directory
  for (const f of uploadsFiles) {
    const normF = normalize(f.split('.')[0])
    if (normF === normName) {
      return { file: f, folder: 'public/uploads', path: path.join(uploadsDir, f) }
    }
  }

  return null
}

async function preview() {
  const { data: products } = await supabase.from('products').select('id, name, categories(name)')
  
  console.log('=== PRODUCT IMAGE MATCH PREVIEW ===\n')
  const matches = []
  const missing = []

  for (const p of products || []) {
    const isStat = p.categories?.name === 'Office Stationery'
    const match = findBestMatch(p.name, isStat)
    if (match) {
      matches.push({ product: p.name, category: p.categories?.name, matchFile: match.file, folder: match.folder })
      console.log(`✓ MATCHED: [${p.categories?.name}] "${p.name}" -> ${match.folder}/${match.file}`)
    } else {
      missing.push({ product: p.name, category: p.categories?.name })
      console.log(`❌ NO MATCH: [${p.categories?.name}] "${p.name}"`)
    }
  }

  console.log(`\nMatched: ${matches.length} / ${products.length}`)
  console.log(`Missing: ${missing.length} / ${products.length}`)
}

preview()
