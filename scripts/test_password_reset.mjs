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

async function testPasswordResetFlow() {
  console.log('=== TESTING FORGOT & RESET PASSWORD FLOW ===\n')

  const testEmail = 'ayanshaikh17653@gmail.com'
  const newPassword = 'Password@123'

  // Step 1: Trigger Forgot Password
  console.log('Step 1: Calling POST /api/auth/forgot-password...')
  const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  })
  console.log('Forgot Password Status:', forgotRes.status)
  const forgotData = await forgotRes.json()
  console.log('Forgot Password Response:', forgotData)

  // Step 2: Call Reset Password to set new password
  console.log('\nStep 2: Calling POST /api/auth/reset-password...')
  const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: newPassword })
  })
  console.log('Reset Password Status:', resetRes.status)
  const resetData = await resetRes.json()
  console.log('Reset Password Response:', resetData)

  // Step 3: Login with updated password to verify!
  console.log('\nStep 3: Logging in with updated password...')
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: newPassword })
  })
  console.log('Login Status:', loginRes.status)
  const loginData = await loginRes.json()
  console.log('Login Result:', {
    user_email: loginData.user?.email,
    user_role: loginData.user?.role,
    has_token: !!loginData.token
  })
}

testPasswordResetFlow()
