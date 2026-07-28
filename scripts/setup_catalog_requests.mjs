import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envText = fs.readFileSync('.env', 'utf-8')
const envVars = {}
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) envVars[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '')
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runSQL() {
  const sql = fs.readFileSync('schema-catalog-requests.sql', 'utf-8')
  console.log('📜 SQL Schema to apply in Supabase Dashboard SQL Editor:')
  console.log('=====================================================')
  console.log(sql)
  console.log('=====================================================')

  // Attempt executing SQL statement via Supabase DB RPC if available
  const { error: rpcErr } = await supabase.rpc('exec_sql', { sql_query: sql })
  if (rpcErr) {
    console.log('ℹ️ RPC exec_sql note:', rpcErr.message)
  }
}

runSQL()
