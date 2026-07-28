import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'

const env = {}
for (const line of readFileSync(path.resolve('.env'), 'utf-8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function run() {
  for (const table of ['categories', 'products']) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.log(`${table}: ERROR - ${error.message}`)
    } else if (data && data[0]) {
      console.log(`${table} columns: ${Object.keys(data[0]).join(', ')}`)
    } else {
      console.log(`${table}: exists but empty`)
    }
  }
}
run().catch(e => console.error(e))
