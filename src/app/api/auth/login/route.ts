import { NextResponse } from 'next/server';
import { supabaseAdmin, withRetry } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { SESSION_MAX_AGE_SEC } from '@/lib/auth-session';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const STUDENT_DEFAULT_PASSWORD = 'student@kss';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SEC,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { loginType, email, teacher_code, schoolpay_code, password } = body;

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    let user: { id: string; full_name?: string; password_hash?: string; role?: string } | null = null;
    let role = '';

    if (loginType === 'admin') {
      const { data } = await withRetry(() =>
        supabaseAdmin
          .from('teachers')
          .select('*')
          .eq('email', email)
          .eq('status', 'active')
          .in('role', ['admin', 'bursar'])
          .single()
      );
      user = data;
      role = data?.role || 'admin';
    } else if (loginType === 'teacher') {
      const { data } = await withRetry(() =>
        supabaseAdmin
          .from('teachers')
          .select('*')
          .eq('teacher_code', teacher_code)
          .eq('role', 'teacher')
          .eq('status', 'active')
          .single()
      );
      user = data;
      role = 'teacher';
    } else if (loginType === 'student') {
      const { data } = await withRetry(() =>
        supabaseAdmin
          .from('students')
          .select('*')
          .eq('schoolpay_code', schoolpay_code)
          .eq('status', 'active')
          .single()
      );
      user = data;
      role = 'student';
    } else {
      return NextResponse.json({ error: 'Invalid login type' }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please check and try again.' },
        { status: 401 }
      );
    }

    let passwordMatch = false;

    if (loginType === 'student') {
      passwordMatch = password === STUDENT_DEFAULT_PASSWORD;
    } else {
      passwordMatch = await bcrypt.compare(password, user.password_hash || '');
    }

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please check and try again.' },
        { status: 401 }
      );
    }

    const token = await new SignJWT({
      id: user.id,
      role,
      full_name: user.full_name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);

    const response = NextResponse.json({
      success: true,
      role,
      full_name: user.full_name,
    });

    response.cookies.set('sms_session', token, cookieOptions);
    response.cookies.set('sms_entry', 'sms', cookieOptions);

    return response;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}
