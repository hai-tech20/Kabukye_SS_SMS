import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    if (auth instanceof NextResponse) return auth;
    // Return flat combination records. The DB does not declare FK relationships
    // for subject1_id/subject2_id/subject3_id, so PostgREST expansion fails.
    const { data, error } = await supabaseAdmin
      .from('subject_combinations')
      .select('id, code, name, category, requires_sub_math, requires_sub_ict')
      .order('category', { ascending: true })
      .order('code', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    // Log full error details (including non-enumerable properties) for debugging
    try {
      console.error('Error fetching subject combinations:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch (err) {
      console.error('Error fetching subject combinations (stringify failed):', error);
    }

    const message = process.env.NODE_ENV === 'development'
      ? String((error as any)?.message || error)
      : 'Failed to fetch combinations';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
