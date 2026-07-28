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

async function testCustomerFlow() {
  console.log('=== TESTING CUSTOMER LOGIN & CATALOG API ===\n')

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ayanshaikh17653@gmail.com', password: 'Password@123' })
  })

  console.log('Login Status:', loginRes.status)
  const loginData = await loginRes.json()
  console.log('Login Response:', loginData)

  if (!loginData.token) {
    console.error('Login failed, no token!')
    return
  }

  // 2. Fetch products using the token
  const prodRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { Authorization: `Bearer ${loginData.token}` }
  })

  console.log('\nProducts API Status:', prodRes.status)
  const prodData = await prodRes.json()
  console.log('Products API Response:', JSON.stringify(prodData, null, 2))
}

testCustomerFlow()
