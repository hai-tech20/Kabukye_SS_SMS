import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, withRetry } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const class_id = searchParams.get('class_id');
    
    // Build query with only necessary columns
    let query = supabaseAdmin
      .from('subjects')
      .select('id, name, class_id, paper_count, subject_type');

    if (class_id) {
      query = query.eq('class_id', class_id);
    }
    
    const { data: subjects, error } = await withRetry(
      async () => await query.order('name', { ascending: true }),
      3,
      1000
    );
    
    if (error) throw error;
    
    return NextResponse.json(subjects || []);
  } catch (error) {
    console.error('Subjects API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
