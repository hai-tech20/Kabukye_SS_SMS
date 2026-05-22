import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('subject_combinations')
      .select(`
        *,
        subject1:subject1_id(id, name),
        subject2:subject2_id(id, name),
        subject3:subject3_id(id, name)
      `)
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
