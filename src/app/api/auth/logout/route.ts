import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUrl = searchParams.get('redirect');
  
  const targetPath = await getRoleLoginPath(request);
  const response = NextResponse.redirect(
    redirectUrl || new URL(targetPath, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001')
  );
  response.cookies.set('sms_session', '', { maxAge: 0, path: '/' });
  // Also clear entry cookie if redirecting to website
  if (redirectUrl) {
    response.cookies.set('sms_entry', '', { maxAge: 0, path: '/' });
  }
  
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUrl = searchParams.get('redirect');

  const targetPath = await getRoleLoginPath(request);
  const response = NextResponse.redirect(
    redirectUrl || new URL(targetPath, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001')
  );
  response.cookies.set('sms_session', '', { maxAge: 0, path: '/' });
  // Also clear entry cookie if redirecting to website
  if (redirectUrl) {
    response.cookies.set('sms_entry', '', { maxAge: 0, path: '/' });
  }
  
  return response;
}
