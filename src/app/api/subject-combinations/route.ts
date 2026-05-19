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
    console.error('Error fetching subject combinations:', error);
    return NextResponse.json({ error: 'Failed to fetch combinations' }, { status: 500 });
  }
}
