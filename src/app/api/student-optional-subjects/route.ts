import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireSession, assertStudentSelf } from '@/lib/auth-session';

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');

    if (!student_id) {
      return NextResponse.json(
        { error: 'student_id is required' },
        { status: 400 }
      );
    }

    const denied = assertStudentSelf(auth, student_id);
    if (denied) return denied;

    const { data: optionalSubjects, error } = await supabaseAdmin
      .from('student_optional_subjects')
      .select(`
        id,
        student_id,
        subject_id,
        assigned_by,
        assigned_at
      `)
      .eq('student_id', student_id);

    if (error) {
      console.error('Error fetching optional subjects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch optional subjects' },
        { status: 500 }
      );
    }

    // Fetch all subjects in one query
    let subjectsData: any[] = [];
    if (optionalSubjects && optionalSubjects.length > 0) {
      const subjectIds = Array.from(new Set(optionalSubjects.map((os: any) => os.subject_id)));
      
      const { data: subjects } = await supabaseAdmin
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);
      
      if (subjects) subjectsData = subjects;
    }

    // Create subject map
    const subjectMap = new Map(subjectsData.map((s: any) => [s.id, s]));

    // Combine
    const finalData = optionalSubjects.map((os: any) => ({
      ...os,
      subjects: subjectMap.get(os.subject_id) || null
    }));

    return NextResponse.json({ data: finalData || [] });
  } catch (err) {
    console.error('Error in GET /api/student-optional-subjects:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { student_id, subject_id } = body;

    if (!student_id || !subject_id) {
      return NextResponse.json(
        { error: 'student_id and subject_id are required' },
        { status: 400 }
      );
    }

    // Check if already assigned
    const { data: existing } = await supabaseAdmin
      .from('student_optional_subjects')
      .select('id')
      .eq('student_id', student_id)
      .eq('subject_id', subject_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Subject already assigned to student' },
        { status: 409 }
      );
    }

    // Get current user from JWT cookie
    const cookieHeader = request.headers.get('cookie') || '';
    const sessionMatch = cookieHeader.match(/sms_session=([^;]+)/);
    const token = sessionMatch?.[1];

    let userId = 'admin';
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const decoded = JSON.parse(jsonPayload);
        userId = decoded.id || 'admin';
      } catch {
        console.log('Could not decode JWT, using default admin');
      }
    }

    const { data, error } = await supabaseAdmin
      .from('student_optional_subjects')
      .insert({
        student_id,
        subject_id,
        assigned_by: userId
      });

    if (error) {
      console.error('Error assigning optional subject:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to assign subject' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data?.[0],
      message: 'Optional subject assigned successfully'
    });
  } catch (err: any) {
    console.error('Error in POST /api/student-optional-subjects:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('student_optional_subjects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting optional subject:', error);
      return NextResponse.json(
        { error: 'Failed to delete optional subject' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Optional subject removed successfully'
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/student-optional-subjects:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
