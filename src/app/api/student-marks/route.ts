import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, withRetry } from '@/lib/supabase';
import { getSession } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryStudentId = searchParams.get('student_id');
    const term = searchParams.get('term');
    const year = searchParams.get('year');

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: If logged in as a student, they can ONLY see their own marks.
    // If logged in as admin/teacher, they can query by student_id.
    let studentId = session.id;
    if (session.role !== 'student' && queryStudentId) {
      studentId = queryStudentId;
    } else if (session.role === 'student' && queryStudentId && queryStudentId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch grades for this student
    let query = supabaseAdmin
        .from('grades')
        .select(`
          id,
          subject_id,
          bot_score,
          mot_score,
          eot_score,
          final_score,
          academic_year,
          term,
          subjects (
            name,
            paper_count
          ),
          grade_papers (
            paper_number,
            score
          )
        `)
        .eq('student_id', studentId);

    if (term) query = query.eq('term', term);
    if (year) query = query.eq('academic_year', year);

    const { data: grades, error } = await withRetry(async () =>
      await query.order('created_at', { ascending: false })
    );

    if (error) throw error;

    // Return all grades found for this student, ordered by most recent first
    return NextResponse.json({ 
      data: grades || [],
      count: grades?.length || 0
    });
  } catch (error) {
    console.error('Error fetching student marks:', error);
    return NextResponse.json({ error: 'Failed to fetch marks' }, { status: 500 });
  }
}
