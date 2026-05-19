import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPath = pathname === '/login' || pathname.startsWith('/login/');

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('sms_session')?.value;
    const hasWebsiteEntry = request.cookies.get('sms_entry')?.value === 'website';

    if (!hasWebsiteEntry) {
      return NextResponse.redirect(process.env.NEXT_PUBLIC_WEBSITE_URL + '/reports');
    }

    if (!token) {
      return NextResponse.redirect(new URL('/login/admin', request.url));
    }

    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch (error) {
      // Invalid token, redirect to login
      const response = NextResponse.redirect(new URL('/login/admin', request.url));
      response.cookies.delete('sms_session');
      return response;
    }
  }

  // Redirect authenticated users away from login page
  if (isLoginPath) {
    const hasWebsiteEntryCookie = request.cookies.get('sms_entry')?.value === 'website';
    const hasWebsiteEntryQuery = request.nextUrl.searchParams.get('entry') === 'website';

    if (!hasWebsiteEntryCookie && !hasWebsiteEntryQuery) {
      return NextResponse.redirect(process.env.NEXT_PUBLIC_WEBSITE_URL + '/reports');
    }

    // Force re-login if coming from website via query param
    if (hasWebsiteEntryQuery) {
      const response = NextResponse.redirect(new URL(pathname, request.url));
      response.cookies.set('sms_entry', 'website', {
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/'
      });
      // Clear existing session to force fresh login
      response.cookies.set('sms_session', '', { maxAge: 0, path: '/' });
      return response;
    }

    if (pathname === '/login') {
      const response = NextResponse.redirect(new URL('/login/admin', request.url));
      return response;
    }

    const token = request.cookies.get('sms_session')?.value;
    
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        
        // Redirect to appropriate dashboard based on role
        const redirectMap = {
          admin: '/dashboard/admin',
          bursar: '/dashboard/bursar', 
          teacher: '/dashboard/teacher',
          student: '/dashboard/student'
        };
        
        const redirectUrl = redirectMap[payload.role as keyof typeof redirectMap] || '/dashboard';
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      } catch (error) {
        // Invalid token, continue to login
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/login/:path*']
};
