import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-session';

/**
 * GET: Fetch optional subjects for a specific class (for class teacher dashboard)
 * Teachers can only view/manage optionals for students in their class and stream
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'teacher' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const class_id = searchParams.get('class_id');

    if (!class_id) {
      return NextResponse.json(
        { error: 'class_id is required' },
        { status: 400 }
      );
    }

    const normalizedClassId = class_id.toLowerCase().trim();
    let studentQuery = supabaseAdmin
      .from('students')
      .select(`
        id,
        full_name,
        class_id,
        stream_id,
        streams:stream_id(name),
        student_optional_subjects(
          id,
          subject_id,
          assigned_by
        )
      `)
      .eq('class_id', normalizedClassId);

    if (session.role === 'teacher') {
      const { data: teacherData, error: teacherError } = await supabaseAdmin
        .from('teachers')
        .select('class_teacher_class_id, class_teacher_stream_id, is_class_teacher')
        .eq('id', session.id)
        .single();

      if (teacherError || !teacherData || !teacherData.is_class_teacher) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const teacherClass = teacherData.class_teacher_class_id?.toLowerCase().trim();
      const teacherStream = teacherData.class_teacher_stream_id?.toLowerCase().trim();

      if (!teacherClass || !teacherStream || teacherClass !== normalizedClassId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      studentQuery = studentQuery.eq('stream_id', teacherStream);
    }

    const { data, error } = await studentQuery;

    if (error) {
      console.error('Error fetching class optional subjects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch optional subjects' },
        { status: 500 }
      );
    }

    // Fetch all subjects in one query
    let subjectsData: any[] = [];
    const allOptionalSubjects = (data || []).flatMap((student: any) => student.student_optional_subjects || []);
    if (allOptionalSubjects.length > 0) {
      const subjectIds = Array.from(new Set(allOptionalSubjects.map((os: any) => os.subject_id)));
      const { data: subjects } = await supabaseAdmin
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);
      if (subjects) subjectsData = subjects;
    }

    const subjectMap = new Map(subjectsData.map((s: any) => [s.id, s]));

    const enrichedData = (data || []).map((student: any) => ({
      ...student,
      student_optional_subjects: (student.student_optional_subjects || []).map((os: any) => ({
        ...os,
        subjects: subjectMap.get(os.subject_id) || null
      }))
    }));

    return NextResponse.json({ data: enrichedData });
  } catch (err) {
    console.error('Error in GET /api/teachers/optional-subjects:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Assign optional subject for a student (teacher can assign to their class students)
 */
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

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.role !== 'teacher' && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const userId = session.id;

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select('class_id, stream_id')
      .eq('id', student_id)
      .single();

    if (studentError || !studentData) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    if (session.role === 'teacher') {
      const { data: teacherData, error: teacherError } = await supabaseAdmin
        .from('teachers')
        .select('class_teacher_class_id, class_teacher_stream_id, is_class_teacher')
        .eq('id', userId)
        .single();

      if (teacherError || !teacherData || !teacherData.is_class_teacher) {
        return NextResponse.json(
          { error: 'You are not authorized to manage optionals for this class' },
          { status: 403 }
        );
      }

      const teacherClassId = teacherData.class_teacher_class_id?.toString().toLowerCase().trim();
      const teacherStreamId = teacherData.class_teacher_stream_id?.toString().toLowerCase().trim();
      const studentClassId = studentData.class_id?.toString().toLowerCase().trim();
      const studentStreamId = studentData.stream_id?.toString().toLowerCase().trim();

      if (!teacherClassId || !teacherStreamId || teacherClassId !== studentClassId || teacherStreamId !== studentStreamId) {
        return NextResponse.json(
          { error: 'You are not authorized to manage optionals for this class' },
          { status: 403 }
        );
      }
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

    // Check max number of optional subjects based on class
    const { data: currentOptionals, error: countError } = await supabaseAdmin
      .from('student_optional_subjects')
      .select('id')
      .eq('student_id', student_id);
      
    const currentCount = (currentOptionals || []).length;
    const studentClassId = studentData.class_id?.toLowerCase().trim();
    const isS1S2 = studentClassId === 's1' || studentClassId === 's2';
    const maxOptionals = isS1S2 ? 3 : 2;
    
    if (currentCount >= maxOptionals) {
      return NextResponse.json(
        { error: `Maximum ${maxOptionals} optional subjects allowed for ${studentClassId.toUpperCase()}` },
        { status: 400 }
      );
    }

    // Insert the optional subject
    const { data, error } = await supabaseAdmin
      .from('student_optional_subjects')
      .insert({
        student_id,
        subject_id,
        assigned_by: userId
      })
      .select();

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
    console.error('Error in POST /api/teachers/optional-subjects:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove optional subject assignment (teacher for their class, or admin)
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.role !== 'teacher' && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    if (session.role === 'teacher') {
      const { data: optionalAssignment, error: assignmentError } = await supabaseAdmin
        .from('student_optional_subjects')
        .select('id, student_id, students(class_id, stream_id)')
        .eq('id', id)
        .single();

      if (assignmentError || !optionalAssignment) {
        return NextResponse.json(
          { error: 'Optional assignment not found' },
          { status: 404 }
        );
      }

      const { data: teacherData, error: teacherError } = await supabaseAdmin
        .from('teachers')
        .select('class_teacher_class_id, class_teacher_stream_id, is_class_teacher')
        .eq('id', session.id)
        .single();

      if (teacherError || !teacherData || !teacherData.is_class_teacher) {
        return NextResponse.json(
          { error: 'You are not authorized to manage optionals for this class' },
          { status: 403 }
        );
      }

      const teacherClassId = teacherData.class_teacher_class_id?.toString().toLowerCase().trim();
      const teacherStreamId = teacherData.class_teacher_stream_id?.toString().toLowerCase().trim();
      const studentClassId = Array.isArray((optionalAssignment as any).students) 
        ? (optionalAssignment as any).students[0]?.class_id?.toString().toLowerCase().trim() 
        : (optionalAssignment as any).students?.class_id?.toString().toLowerCase().trim();
      const studentStreamId = Array.isArray((optionalAssignment as any).students) 
        ? (optionalAssignment as any).students[0]?.stream_id?.toString().toLowerCase().trim() 
        : (optionalAssignment as any).students?.stream_id?.toString().toLowerCase().trim();

      if (!teacherClassId || !teacherStreamId || teacherClassId !== studentClassId || teacherStreamId !== studentStreamId) {
        return NextResponse.json(
          { error: 'You are not authorized to manage optionals for this class' },
          { status: 403 }
        );
      }
    }

    const { error } = await supabaseAdmin
      .from('student_optional_subjects')
      .delete()
      .eq('id', id);

    return NextResponse.json({
      success: true,
      message: 'Optional subject removed successfully'
    });
  } catch (err) {
    console.error('Error in DELETE /api/teachers/optional-subjects:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
