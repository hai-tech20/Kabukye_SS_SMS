import { NextResponse } from 'next/server';
import { supabaseAdmin, withRetry } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const STUDENT_DEFAULT_PASSWORD = 'student@kss';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { loginType, email, teacher_code, schoolpay_code, password } = body;

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    let user: any = null;
    let role = '';

    // No more mock data. Always use Supabase with retry logic.
    if (loginType === 'admin') {
      const { data, error } = await withRetry(() =>
        supabaseAdmin
          .from('teachers')
          .select('*')
          .eq('email', email)
          .eq('status', 'active')
          .in('role', ['admin', 'bursar'])
          .single()
      );
      user = data;
      role = data?.role;

    } else if (loginType === 'teacher') {
      const { data, error } = await withRetry(() =>
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
      const { data, error } = await withRetry(() =>
        supabaseAdmin
          .from('students')
          .select('*')
          .eq('schoolpay_code', schoolpay_code)
          .eq('status', 'active')
          .single()
      );
      user = data;
      role = 'student';
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials. Please check and try again.' }, { status: 401 });
    }

    let passwordMatch = false;

    // Students use a shared portal password and schoolpay code as their ID.
    if (loginType === 'student') {
      passwordMatch = password === STUDENT_DEFAULT_PASSWORD;
    } else {
      passwordMatch = await bcrypt.compare(password, user.password_hash);
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials. Please check and try again.' }, { status: 401 });
    }

    const token = await new SignJWT({
      id: user.id,
      role: role,
      full_name: user.full_name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);

    const response = NextResponse.json({
      success: true,
      role: role,
      full_name: user.full_name,
    });

    // Use session cookie (no maxAge) so it expires when browser/tab is closed
    response.cookies.set('sms_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('=== LOGIN API CRASHED ===', error);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}
