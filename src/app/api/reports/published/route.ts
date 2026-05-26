import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireSession, assertStudentSelf } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (studentId) {
      const denied = assertStudentSelf(auth, studentId);
      if (denied) return denied;
      // Fetch specific student report cards
      const { data, error } = await supabaseAdmin
        .from('report_cards')
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'published')
        .order('academic_year', { ascending: false })
        .order('term', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (auth.role !== 'admin' && auth.role !== 'bursar') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('report_settings')
      .select('*')
      .eq('is_published', true)
      .order('academic_year', { ascending: false })
      .order('term', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching published reports:', error);
    return NextResponse.json({ error: 'Failed to fetch published reports' }, { status: 500 });
  }
}
