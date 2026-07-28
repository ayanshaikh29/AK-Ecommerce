import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import crypto from 'crypto'

try {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=')
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
  })
} catch (e) {}

const SECRET = process.env.AUTH_SECRET || 'lumiere-supersecret-change-me-2025'
function hashPw(pw) { return crypto.createHmac('sha256', SECRET).update(pw).digest('hex') }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function setPassword() {
  const email = 'ayanshaikh17653@gmail.com'
  const newPassword = 'Password@123'

  console.log(`Setting password for ${email} to: ${newPassword}`)

  // 1. Update public.users
  const { error: dbErr } = await supabase.from('users')
    .update({ password: hashPw(newPassword) })
    .eq('email', email)

  if (dbErr) console.error('Error updating DB password:', dbErr)
  else console.log('DB password updated successfully!')

  // 2. Update auth.users
  const { data: authData } = await supabase.auth.admin.listUsers()
  const authUser = authData?.users?.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (authUser) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(authUser.id, { password: newPassword })
    if (authErr) console.error('Error updating Auth password:', authErr)
    else console.log('Auth password updated successfully!')
  }
}

setPassword()
