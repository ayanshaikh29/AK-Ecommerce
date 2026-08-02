import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envRaw = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
const env = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ID = 'afd4a544-c12e-4622-a13f-8b07829f72f2'

console.log('=== Query users by id (POSTGRES cast test) ===')
const { data: a, error: ea } = await supabase.from('users').select('id, email, role, gst_number, full_name, phone').eq('id', ID)
console.log('eq(id, string):', JSON.stringify(a), 'error:', ea?.message)

const { data: b, error: eb } = await supabase.from('users').select('id, email, role, gst_number').eq('email', 'admin@store.com')
console.log('eq(email):', JSON.stringify(b), 'error:', eb?.message)

console.log('\n=== Query users.gst_number for admin to see column values ===')
const { data: c, error: ec } = await supabase.from('users').select('id, email, role, gst_number').eq('email', 'admin@store.com')
console.log('admin row gst_number=', c?.[0]?.gst_number, '| json:', c, 'err:', ec?.message)

console.log('\n=== Does /api/auth/me select gst_number cause the null? Test with only id,role ===')
const { data: d, error: ed } = await supabase.from('users').select('id, role').eq('id', ID)
console.log('select(id,role) eq id:', JSON.stringify(d), 'error:', ed?.message)

console.log('\n=== id column type check: list all admin rows raw ===')
const { data: e, error: ee } = await supabase.from('users').select('id, email, role')
console.log('all users:', JSON.stringify((e||[]).map(r=>({id:r.id, role:r.role}))), 'err:', ee?.message)
process.exit(0)