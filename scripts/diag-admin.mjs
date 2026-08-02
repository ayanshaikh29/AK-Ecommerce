import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env')
const envRaw = fs.readFileSync(envPath, 'utf8')
const env = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = env.AUTH_SECRET || 'dev-secret'

console.log('=== CONFIG ===')
console.log('AUTH_SECRET present in .env?', !!env.AUTH_SECRET, '| length:', SECRET.length)

function hashPw(pw) { return crypto.createHmac('sha256', SECRET).update(pw).digest('hex') }
function sign(payload) {
  const payloadWithVersion = { ...payload, _v: 'v2_gst' }
  const body = Buffer.from(JSON.stringify(payloadWithVersion)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}
function verify(token) {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  if (expected !== sig) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (parsed._v !== 'v2_gst') return null
    return parsed
  } catch { return null }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

console.log('\n=== 1) ALL rows for admin@store.com (count reveals duplicates) ===')
const { data: admins, error: adminsErr } = await supabase.from('users').select('id, email, role').eq('email', 'admin@store.com')
if (adminsErr) console.log('  query error:', adminsErr.message)
console.log('  count =', admins ? admins.length : 0)
if (admins) for (const a of admins) console.log(`  id=${a.id} email=${a.email} role=${a.role}`)

console.log('\n=== 2) Login query (route.js:477) ===')
const { data: byEmail } = await supabase.from('users').select('id, email, role, password, full_name').eq('email', 'admin@store.com')
console.log('  rows by email, with pw match against hashPw("Admin@123"):', (byEmail || []).map(r => ({ id: r.id, role: r.role, pwMatch: r.password === hashPw('Admin@123') })))

const { data: u } = await supabase.from('users').select('id, email, role, password, full_name').eq('email', 'admin@store.com').eq('password', hashPw('Admin@123')).maybeSingle()
console.log('  login maybeSingle() u =', u ? { id: u.id, email: u.email, role: u.role, full_name: u.full_name } : null)
if (!u) { console.log('\n  >>> LOGIN WOULD RETURN "Invalid credentials" (401) <<<'); process.exit(0) }

console.log('\n=== 3) Token payload before sign() at route.js:550 ===')
const tokenPayload = { id: u.id, email: u.email, role: u.role, name: u.full_name, gst_number: u.gst_number || '' }
console.log('  payload signed into JWT:', JSON.stringify(tokenPayload))
const token = sign(tokenPayload)

console.log('\n=== 4) getUser() role resolution (route.js:122-148) ===')
const parsed = verify(token)
console.log('  decoded token payload (before DB lookup):', JSON.stringify(parsed))
let roleFromGetUser = null, idFromGetUser = null
if (parsed && parsed.email) {
  const { data: dbUser, error: dbErr } = await supabase.from('users').select('id, email, role, full_name, phone').eq('email', parsed.email).maybeSingle()
  if (dbErr) console.log('  DB lookup error:', dbErr.message)
  console.log('  DB lookup by email returned:', dbUser ? { id: dbUser.id, role: dbUser.role } : null)
  if (dbUser) { parsed.id = dbUser.id; parsed.role = dbUser.role; roleFromGetUser = dbUser.role; idFromGetUser = dbUser.id }
}
console.log('  final getUser() role =', roleFromGetUser, '| id =', idFromGetUser)

console.log('\n=== 5) /api/auth/me logic (route.js:554-558) ===')
if (idFromGetUser) {
  const { data: me } = await supabase.from('users').select('id, email, full_name, phone, role, gst_number').eq('id', idFromGetUser).maybeSingle()
  console.log('  /api/auth/me user =', me ? { id: me.id, email: me.email, role: me.role } : null)
  console.log('  >>> role-check u.role !== "admin" ->', me ? (me.role !== 'admin' ? 'DENIED - Access denied: Admin role required' : 'GRANTED - admin access OK') : 'me returned null -> would 404/500')
} else {
  console.log('  No id resolved.')
}
process.exit(0)