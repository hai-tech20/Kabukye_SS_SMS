import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret')

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Define public paths that don't need authentication
  const publicPaths = ['/', '/login', '/login/teacher', '/login/student', '/login/admin', '/test', '/test-simple']
  const isPublicPath = publicPaths.some(p => path === p || path.startsWith(p) && path.charAt(p.length) === '/')

  // Check if we're in a dashboard or api route that needs auth
  const isProtectedPath = path.startsWith('/dashboard') || path.startsWith('/api') && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/me')

  if (!isPublicPath || isProtectedPath) {
    // Get the token from cookies
    const token = request.cookies.get('sms_session')?.value

    if (!token) {
      // Redirect to login page
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }

    try {
      // Verify the token
      await jwtVerify(token, secret())
      // Token is valid, proceed
      return NextResponse.next()
    } catch (error) {
      // Invalid token, redirect to login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // For public paths, just proceed
  return NextResponse.next()
}

// Configure the middleware to apply to specific paths
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*'
  ]
}
