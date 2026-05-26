import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getWebsiteReportsUrl } from '@/lib/website-url';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

async function getRoleLoginPath(request: Request): Promise<string> {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookiePair = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('sms_session='));

  if (!cookiePair) return '/login/admin';

  const token = decodeURIComponent(cookiePair.replace('sms_session=', ''));

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = String(payload.role || '');
    if (role === 'teacher') return '/login/teacher';
    if (role === 'student') return '/login/student';
    return '/login/admin';
  } catch {
    return '/login/admin';
  }
}

function clearSessionResponse(request: Request, redirectPath: string, redirectToWebsite = false) {
  const target = redirectToWebsite
    ? getWebsiteReportsUrl()
    : new URL(redirectPath, process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3001').toString();
  const response = NextResponse.redirect(target);
  response.cookies.set('sms_session', '', { maxAge: 0, path: '/' });
  response.cookies.set('sms_entry', '', { maxAge: 0, path: '/' });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const toWebsite = searchParams.get('redirect') === 'website';
  const targetPath = await getRoleLoginPath(request);
  return clearSessionResponse(request, targetPath, toWebsite);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const toWebsite = searchParams.get('redirect') === 'website';
  const targetPath = await getRoleLoginPath(request);
  return clearSessionResponse(request, targetPath, toWebsite);
}
