import { readFileSync } from 'fs'
import path from 'path'

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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

async function run() {
  console.log('Fetching OpenAPI paths to find RPC functions...')
  const url = `${supabaseUrl}/rest/v1/`
  
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    })
    if (!res.ok) {
      console.error(`HTTP error: ${res.status} ${res.statusText}`)
      return
    }
    const openapi = await res.json()
    const paths = Object.keys(openapi.paths || {})
    const rpcPaths = paths.filter(p => p.startsWith('/rpc/'))
    console.log('RPC paths found:', rpcPaths)
  } catch (err) {
    console.error('Fetch failed:', err)
  }
}

run()
