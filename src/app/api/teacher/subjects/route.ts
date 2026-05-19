import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, withRetry } from '@/lib/supabase';
import { getSession } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    // Get teacher ID from JWT token
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    if (session.role !== 'teacher' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Teacher or Admin required' }, { status: 403 });
    }
    
    const teacherId = session.id;
    
    // Use retry logic for reliable connection
    const { data, error } = await withRetry(async () =>
      await supabaseAdmin
        .from('teacher_subjects')
        .select(`
          *,
          classes(name),
          streams(name),
          subjects(name, paper_count)
        `)
        .eq('teacher_id', teacherId)
    );

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching teacher subjects:', error);
    return NextResponse.json({ error: 'Failed to fetch teacher subjects' }, { status: 500 });
  }
}
