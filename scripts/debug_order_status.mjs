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

async function debugOrderStatusAPI() {
  console.log('=== TESTING API PUT /api/orders/8bc334ef-6920-46ac-aa86-2359a7a43abc ===\n')

  const targetOrderId = '8bc334ef-6920-46ac-aa86-2359a7a43abc'

  // Admin login
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@store.com', password: 'Admin@123' })
  })

  const adminData = await adminRes.json()

  // Update status to 'confirmed'
  const putRes = await fetch(`${BASE_URL}/api/orders/${targetOrderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminData.token}`
    },
    body: JSON.stringify({ status: 'confirmed' })
  })

  console.log('PUT Response Status:', putRes.status)
  const putResult = await putRes.json()
  console.log('PUT Response Body:', putResult)
}

debugOrderStatusAPI()
