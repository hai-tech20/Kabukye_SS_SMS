import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

type Role = 'admin' | 'bursar' | 'teacher' | 'student';

const ROLE_DASHBOARD: Record<Role, string> = {
  admin: '/dashboard/admin',
  bursar: '/dashboard/bursar',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
};

const DASHBOARD_ROLE_PREFIX: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/dashboard/admin', roles: ['admin'] },
  { prefix: '/dashboard/bursar', roles: ['bursar', 'admin'] },
  { prefix: '/dashboard/teacher', roles: ['teacher', 'admin'] },
  { prefix: '/dashboard/student', roles: ['student'] },
];

function loginPathForDashboard(pathname: string): string {
  if (pathname.startsWith('/dashboard/teacher')) return '/login/teacher';
  if (pathname.startsWith('/dashboard/student')) return '/login/student';
  if (pathname.startsWith('/dashboard/bursar')) return '/login/admin';
  return '/login/admin';
}

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as { id?: string; role?: string; full_name?: string };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPath = pathname === '/login' || pathname.startsWith('/login/');

  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('sms_session')?.value;
    const loginPath = loginPathForDashboard(pathname);

    if (!token) {
      return NextResponse.redirect(new URL(loginPath, request.url));
    }

    try {
      const payload = await verifyToken(token);
      const role = (payload.role || '') as Role;
      const home = ROLE_DASHBOARD[role] || '/login/admin';

      const section = DASHBOARD_ROLE_PREFIX.find((s) => pathname.startsWith(s.prefix));
      if (section && !section.roles.includes(role)) {
        return NextResponse.redirect(new URL(home, request.url));
      }

      const response = NextResponse.next();
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    } catch {
      const response = NextResponse.redirect(new URL(loginPath, request.url));
      response.cookies.set('sms_session', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  if (isLoginPath) {
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/login/admin', request.url));
    }

    // From school website: always clear any existing session so the next user must sign in
    if (request.nextUrl.searchParams.get('entry') === 'website') {
      const cleanUrl = new URL(pathname, request.url);
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set('sms_entry', 'website', {
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      });
      response.cookies.set('sms_session', '', { maxAge: 0, path: '/' });
      return response;
    }

    const token = request.cookies.get('sms_session')?.value;
    if (token) {
      try {
        const payload = await verifyToken(token);
        const role = (payload.role || '') as Role;
        const home = ROLE_DASHBOARD[role];
        if (home) {
          return NextResponse.redirect(new URL(home, request.url));
        }
      } catch {
        // invalid token — show login form
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/login/:path*'],
};
