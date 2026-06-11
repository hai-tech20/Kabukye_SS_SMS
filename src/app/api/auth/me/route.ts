import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sms_session')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { payload } = await jwtVerify(token, secret);
    
    let userData = payload;
    
    if (payload.role === 'teacher') {
      const { data: teacher } = await supabaseAdmin
        .from('teachers')
        .select('*')
        .eq('id', payload.id)
        .single();
      if (teacher) {
        userData = { ...payload, ...teacher };
      }
    } else if (payload.role === 'student') {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('*')
        .eq('id', payload.id)
        .single();
      if (student) {
        userData = { ...payload, ...student };
      }
    } else if (payload.role === 'admin') {
      // For admin, just return the payload
    }
    
    const response = NextResponse.json(userData);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
}
