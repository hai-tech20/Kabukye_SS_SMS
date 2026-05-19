import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sms_session')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { payload } = await jwtVerify(token, secret);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
}
