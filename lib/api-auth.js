// ================================================================
// Shared auth + DB helpers for API routes
// ----------------------------------------------------------------
// Mirrors the token scheme used in app/api/[[...path]]/route.js so
// that the reports API authenticates identically to the rest of the
// app (HMAC-signed bearer token, authoritative role from the DB).
// ================================================================
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SECRET = process.env.AUTH_SECRET || 'dev-secret'

let _supabase = null

export function db() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    })
  }
  return _supabase
}

export function hashPw(pw) {
  return crypto.createHmac('sha256', SECRET).update(pw).digest('hex')
}

export function sign(payload) {
  const payloadWithVersion = { ...payload, _v: 'v2_gst' }
  const body = Buffer.from(JSON.stringify(payloadWithVersion)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verify(token) {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  if (expected !== sig) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (parsed._v !== 'v2_gst') return null
    return parsed
  } catch (e) {
    return null
  }
}

// Resolves the authenticated user (id, email, role, full_name, phone).
// Role is taken from the DB, never from the token payload.
export async function getUser(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const parsed = verify(token)
  if (!parsed) return null

  if (parsed.email) {
    const supabase = db()
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, email, role, full_name, phone')
      .eq('email', parsed.email)
      .maybeSingle()
    if (error) {
      console.error(`[getUser] DB lookup error for ${parsed.email}:`, error.message)
    }
    if (dbUser) {
      parsed.id = dbUser.id
      parsed.role = dbUser.role
      parsed.full_name = dbUser.full_name
      parsed.phone = dbUser.phone || ''
    }
  }
  return parsed
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}

export function err(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}
