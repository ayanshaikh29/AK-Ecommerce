import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env manually
try {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=')
    if (key && vals.length) {
      process.env[key.trim()] = vals.join('=').trim()
    }
  })
} catch (e) {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  console.log('=== AUDITING USERS ===')
  
  // Fetch auth.users via admin API
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr) {
    console.error('Error listing auth users:', authErr)
    return
  }
  const authUsers = authData.users || []
  console.log(`Auth users count: ${authUsers.length}`)
  authUsers.forEach(u => console.log(`  AUTH: ${u.email} -> id: ${u.id}`))

  // Fetch public.users
  const { data: publicUsers, error: pubErr } = await supabase.from('users').select('*')
  if (pubErr) {
    console.error('Error listing public users:', pubErr)
    return
  }
  console.log(`Public users count: ${publicUsers.length}`)
  publicUsers.forEach(u => console.log(`  PUBLIC: ${u.email} -> id: ${u.id}, role: ${u.role}`))

  // Check mismatches
  console.log('\n=== MISMATCH ANALYSIS ===')
  for (const pUser of publicUsers) {
    const matchingAuth = authUsers.find(a => a.email.toLowerCase() === pUser.email.toLowerCase())
    if (matchingAuth) {
      if (matchingAuth.id !== pUser.id) {
        console.log(`MISMATCH FOUND for ${pUser.email}:`)
        console.log(`  auth.users id:   ${matchingAuth.id}`)
        console.log(`  public.users id: ${pUser.id}`)
      } else {
        console.log(`MATCH OK for ${pUser.email}: ${pUser.id}`)
      }
    } else {
      console.log(`NO AUTH USER EXISTS for public user: ${pUser.email} (id: ${pUser.id})`)
    }
  }

  for (const aUser of authUsers) {
    const matchingPub = publicUsers.find(p => p.email.toLowerCase() === aUser.email.toLowerCase())
    if (!matchingPub) {
      console.log(`NO PUBLIC USER ROW for auth user: ${aUser.email} (id: ${aUser.id})`)
    }
  }
}

main()
