import { readFileSync } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

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
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

async function setup() {
  console.log('--- Testing public.activity_logs table ---')
  const { data, error } = await supabase.from('activity_logs').select('id').limit(1)
  if (error && error.code === '42P01') {
    console.log('activity_logs table does not exist in Supabase yet.')
  } else if (error) {
    console.log('activity_logs error:', error.message)
  } else {
    console.log('SUCCESS: public.activity_logs table exists and is active! Sample rows:', data ? data.length : 0)
  }
}

setup()
