import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

try {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=')
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
  })
} catch (e) {}

const BASE_URL = 'http://localhost:3000'

async function testCustomerLoginsEndpoint() {
  console.log('=== TESTING /api/admin/customer-logins ENDPOINT ===\n')

  // Sign in as admin
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@store.com', password: 'Admin@123' })
  })

  const adminData = await adminRes.json()

  // Fetch customer logins roster
  const rosterRes = await fetch(`${BASE_URL}/api/admin/customer-logins`, {
    headers: { Authorization: `Bearer ${adminData.token}` }
  })

  console.log('Roster API Status:', rosterRes.status)
  const roster = await rosterRes.json()
  console.log('Roster API Payload:', JSON.stringify(roster, null, 2))
}

testCustomerLoginsEndpoint()
