import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import fs from 'fs'

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

function hashPw(p) {
  return crypto.createHash('sha256').update(p + 'AK_ENTERPRISES_SALT_2026').digest('hex')
}

async function testSignupLogicDirectly() {
  console.log('=== TESTING SIGNUP BACKEND DB LOGIC DIRECTLY ===\n')

  const testEmail = `signup_verify_${Date.now()}@example.com`
  const password = 'TestPassword@123'
  const full_name = 'Verification Tester'
  const phone = '+91 9988776655'

  console.log('1. Creating auth user in Supabase Auth...')
  const { data: newAuthUser, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password,
    email_confirm: true
  })

  if (authErr) {
    console.error('Auth error:', authErr.message)
    return
  }

  const newUuid = newAuthUser.user.id
  console.log('Created Auth User ID:', newUuid)

  const u = {
    id: newUuid,
    email: testEmail,
    password: hashPw(password),
    full_name,
    phone,
    role: 'customer',
    created_at: new Date().toISOString()
  }

  console.log('2. Inserting into public.users table...')
  let uErr = null
  const uWithReferral = { ...u, referral_code: 'REF123', referred_by_id: null }
  const res1 = await supabase.from('users').insert(uWithReferral)
  if (res1.error) {
    console.log('Insert with referral failed as expected:', res1.error.message)
    console.log('Retrying insert into users table without referral columns...')
    const res2 = await supabase.from('users').insert(u)
    uErr = res2.error
  }

  if (uErr) {
    console.error('Final users table insert failed:', uErr.message)
    await supabase.auth.admin.deleteUser(newUuid)
    return
  }

  console.log('✓ Successfully inserted into public.users table!')

  console.log('3. Inserting into public.profiles table...')
  const { error: pErr } = await supabase.from('profiles').insert({
    id: newUuid,
    full_name,
    phone,
    role: 'customer',
    created_at: u.created_at,
    updated_at: u.created_at
  })

  if (pErr) console.error('Profile insertion error:', pErr.message)
  else console.log('✓ Successfully inserted into public.profiles table!')

  // Now verify querying user and logging in via DB lookup
  console.log('\n4. Verifying login database lookup for newly signed up user...')
  const { data: dbUser } = await supabase.from('users').select('*').eq('email', testEmail).eq('password', hashPw(password)).maybeSingle()
  console.log('Login verification result:', {
    found: !!dbUser,
    id: dbUser?.id,
    email: dbUser?.email,
    role: dbUser?.role
  })
}

testSignupLogicDirectly()
