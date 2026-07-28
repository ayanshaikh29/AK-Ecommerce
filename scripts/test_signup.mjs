const BASE_URL = 'http://localhost:3000'

async function testSignup() {
  console.log('=== TESTING SIGNUP FLOW ===\n')

  const testEmail = `test_${Date.now()}@example.com`
  const testPassword = 'TestPass@123'
  const testName = 'Test User'

  console.log('Attempting signup with:', { email: testEmail, password: testPassword, full_name: testName })

  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      full_name: testName,
      phone: '+91 9876543210'
    })
  })

  console.log('Status:', res.status)
  const data = await res.json()
  console.log('Full response body:', JSON.stringify(data, null, 2))

  if (res.ok && data.token) {
    console.log('\n✅ Signup succeeded!')
    console.log('User:', data.user)

    // Now try logging in with the same credentials
    console.log('\n--- Verifying login with new account ---')
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    })
    console.log('Login Status:', loginRes.status)
    const loginData = await loginRes.json()
    console.log('Login response:', JSON.stringify(loginData, null, 2))
  } else {
    console.log('\n❌ Signup FAILED')
    console.log('Error field:', data.error)
    console.log('Message field:', data.message)
  }
}

testSignup().catch(e => console.error('Script error:', e))
