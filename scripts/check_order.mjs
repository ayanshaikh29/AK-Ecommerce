import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envRaw = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
const env = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

async function main() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, gst_number, business_name, company_name')
    .not('gst_number', 'is', null)

  if (error) {
    console.error("Error fetching users with GST:", error)
    return
  }

  console.log("Users with GST:")
  for (const u of users) {
    console.log(`User: ${u.id} | Email: ${u.email} | GST: ${u.gst_number} | Business Name: ${u.business_name} | Company Name: ${u.company_name}`)
  }
}

main()
