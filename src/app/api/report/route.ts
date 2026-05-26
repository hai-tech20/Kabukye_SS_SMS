import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireSession, assertStudentSelf } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (!studentId) {
      return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });
    }

    const denied = assertStudentSelf(auth, studentId);
    if (denied) return denied;
    const term = searchParams.get('term');
    const year = searchParams.get('year');

    if (!term || !year) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (auth.role === 'teacher') {
      const { data: studentRow } = await supabaseAdmin
        .from('students')
        .select('class_id, stream_id')
        .eq('id', studentId)
        .single();
      if (studentRow) {
        const { data: assignment } = await supabaseAdmin
          .from('teacher_subjects')
          .select('id')
          .eq('teacher_id', auth.id)
          .eq('class_id', studentRow.class_id)
          .eq('stream_id', studentRow.stream_id)
          .limit(1);
        if (!assignment?.length) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    // Fetch student info
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        classes(name),
        streams(name)
      `)
      .eq('id', studentId)
      .single();

    if (studentError) throw studentError;

    // Fetch grades
    const { data: grades, error: gradesError } = await supabaseAdmin
      .from('grades')
      .select(`
        *,
        subjects(name)
      `)
      .eq('student_id', studentId)
      .eq('term', term)
      .eq('academic_year', year);

    if (gradesError) throw gradesError;

    // Fetch comments
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('student_comments')
      .select('*')
      .eq('student_id', studentId)
      .eq('term', term)
      .eq('academic_year', year)
      .single();

    let resolvedComments = comments || null;

    if (!resolvedComments) {
      // Generate fallback comments if the comment record does not exist
      const isALevel = Boolean(student.subject_combination);
      let classTeacherComment = '';
      let headTeacherComment = '';

      if (!isALevel) {
        const { data: gradeRows, error: gradeError } = await supabaseAdmin
          .from('grades')
          .select('final_score')
          .eq('student_id', studentId)
          .eq('term', term)
          .eq('academic_year', year);

        const scores = (gradeRows || []).map((row: any) => row.final_score || 0);
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum: number, value: number) => sum + value, 0) / scores.length) : 0;

        if (avgScore >= 80) {
          classTeacherComment = 'Perfect, keep it up';
          headTeacherComment = 'Excellent, keep it up';
        } else if (avgScore >= 70) {
          classTeacherComment = 'Good performance';
          headTeacherComment = 'Very good performance';
        } else if (avgScore >= 60) {
          classTeacherComment = 'Can do better than this';
          headTeacherComment = 'Above average';
        } else if (avgScore >= 50) {
          classTeacherComment = 'More effort is needed';
          headTeacherComment = 'Quite good';
        } else if (avgScore >= 40) {
          classTeacherComment = 'More effort is needed';
          headTeacherComment = 'Fair performance';
        } else {
          classTeacherComment = 'Needs practice';
          headTeacherComment = 'Requires support';
        }
      } else {
        const totalPoints = student.total_uace_points ?? 0;

        if (totalPoints >= 16) {
          classTeacherComment = 'Very good performance';
          headTeacherComment = 'Excellent performance';
        } else if (totalPoints >= 10) {
          classTeacherComment = 'Promising results';
          headTeacherComment = 'Quite good performance';
        } else if (totalPoints >= 6) {
          classTeacherComment = 'More effort is needed';
          headTeacherComment = 'Can do better than this';
        } else if (totalPoints >= 1) {
          classTeacherComment = 'Improve on the weak areas';
          headTeacherComment = 'Work harder';
        } else {
          classTeacherComment = 'Needs assessment';
          headTeacherComment = 'Needs assessment';
        }
      }

      resolvedComments = {
        class_teacher_comment: classTeacherComment,
        head_teacher_comment: headTeacherComment
      };
    }

    return NextResponse.json({
      data: {
        student,
        grades: grades || [],
        comments: resolvedComments
      }
    });
  } catch (error) {
    console.error('Error fetching report data:', error);
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}
