import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SECRET = process.env.AUTH_SECRET || 'dev-secret'

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTarget = searchParams.get('redirect') || '/customer/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('No authorization code returned from Google')}`)
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

    // Exchange auth code for session
    const { data: sessionData, error: sessionErr } = await supabase.auth.exchangeCodeForSession(code)

    if (sessionErr || !sessionData?.user) {
      console.error('Exchange code error:', sessionErr)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Google authorization failed')}`)
    }

    const authUser = sessionData.user
    const email = authUser.email
    const userMeta = authUser.user_metadata || {}
    const fullName = userMeta.full_name || userMeta.name || email.split('@')[0]
    const avatarUrl = userMeta.avatar_url || userMeta.picture || ''

    // Account Linking: Check if user exists by email
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    let dbUser = null
    const now = new Date().toISOString()

    if (existingUser) {
      // Update existing customer record (linking Google OAuth)
      const { data: updated } = await supabase
        .from('users')
        .update({
          avatar_url: avatarUrl || existingUser.avatar_url,
          provider: 'google',
          email_verified: true,
          last_login: now,
          status: 'active'
        })
        .eq('id', existingUser.id)
        .select()
        .single()

      dbUser = updated || { ...existingUser, avatar_url: avatarUrl || existingUser.avatar_url, provider: 'google' }
    } else {
      // Create new customer profile
      const newRecord = {
        id: authUser.id,
        email: email,
        full_name: fullName,
        role: 'customer',
        avatar_url: avatarUrl,
        provider: 'google',
        email_verified: true,
        status: 'active',
        created_at: now,
        last_login: now
      }

      const { data: inserted } = await supabase
        .from('users')
        .insert(newRecord)
        .select()
        .single()

      dbUser = inserted || newRecord
    }

    // Record login in customer_logins table
    try {
      await supabase.from('customer_logins').insert({
        user_id: dbUser.id,
        user_name: dbUser.full_name || fullName,
        email: dbUser.email,
        phone: dbUser.phone || '',
        login_at: now
      })
    } catch (e) {}

    // Emit Realtime Activity Log for Admin Dashboard
    try {
      await supabase.from('activity_logs').insert({
        user_id: dbUser.id,
        user_name: dbUser.full_name || fullName,
        user_email: dbUser.email,
        user_avatar: avatarUrl,
        event_type: 'login',
        title: `${dbUser.full_name || fullName} logged in with Google`,
        description: `Google OAuth login via portal at ${new Date().toLocaleTimeString('en-IN')}`,
        metadata: { provider: 'google', email: dbUser.email },
        is_read: false,
        created_at: now
      })
    } catch (e) {}

    // Issue Application Token using app HMAC signature
    const appToken = sign({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role || 'customer',
      name: dbUser.full_name || fullName,
      avatar_url: avatarUrl
    })

    // Build client redirect with HTML auto-hydration page
    const destinationUrl = dbUser.role === 'admin' ? `${origin}/admin` : dbUser.role === 'vendor' ? `${origin}/vendor` : `${origin}${redirectTarget}`

    const htmlResponse = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authenticating...</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0b0f19; color: #fff; }
            .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div style="text-align: center;">
            <div class="spinner" style="margin: 0 auto 16px;"></div>
            <p style="font-size: 14px; font-weight: 600;">Authenticating with Google...</p>
          </div>
          <script>
            try {
              localStorage.setItem('token', ${JSON.stringify(appToken)});
              localStorage.setItem('user', ${JSON.stringify(JSON.stringify(dbUser))});
              document.cookie = "user_role=${dbUser.role || 'customer'}; path=/; max-age=31536000";
            } catch(e) {}
            window.location.href = ${JSON.stringify(destinationUrl)};
          </script>
        </body>
      </html>
    `

    return new Response(htmlResponse, {
      headers: { 'Content-Type': 'text/html' }
    })
  } catch (err) {
    console.error('OAuth Callback Exception:', err)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Authentication processing error')}`)
  }
}
