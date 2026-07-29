import { NextResponse } from 'next/server'

export function middleware(req) {
  const { pathname } = req.nextUrl

  // Ignore static assets, Next internal files, public favicon/images, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 1. Public Signup Redirect: Redirect /signup to /login
  if (pathname === '/signup' || pathname.startsWith('/signup/')) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('notice', 'signup_disabled')
    return NextResponse.redirect(loginUrl)
  }

  const roleCookie = req.cookies.get('user_role')?.value
  const authTokenCookie = req.cookies.get('auth_token')?.value || req.cookies.get('sb-access-token')?.value

  // Security Check: If user opens public landing page / or public routes (/about, /contact, /login), DO NOT auto-redirect to /admin unless authTokenCookie exists!
  const isPublicRoute = ['/', '/about', '/contact', '/privacy-policy', '/terms-conditions', '/refund-policy', '/login', '/vendor/login', '/forgot-password', '/reset-password'].includes(pathname)

  if (isPublicRoute && !authTokenCookie) {
    return NextResponse.next()
  }

  // Protected Route: /admin requires role=admin AND active token
  if (pathname.startsWith('/admin')) {
    if (!authTokenCookie || roleCookie !== 'admin') {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Protected Route: /vendor (except /vendor/login) requires role=vendor AND active token
  if (pathname.startsWith('/vendor') && pathname !== '/vendor/login') {
    if (!authTokenCookie || roleCookie !== 'vendor') {
      const loginUrl = new URL('/vendor/login', req.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Strict Vendor Guard: Logged-in vendors on non-vendor routes redirect to /vendor
  if (authTokenCookie && roleCookie === 'vendor' && !pathname.startsWith('/vendor')) {
    return NextResponse.redirect(new URL('/vendor', req.url))
  }

  // Strict Admin Guard: Logged-in admins on non-admin routes redirect to /admin
  if (authTokenCookie && roleCookie === 'admin' && !pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
