import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id;
    
    // Get the student's class and stream
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('class_id, stream_id')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Get the class teacher for this class and stream
    const { data: classTeacher, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .select('full_name')
      .eq('is_class_teacher', true)
      .eq('class_teacher_class_id', student.class_id)
      .eq('class_teacher_stream_id', student.stream_id)
      .single();

    if (teacherError) {
      // If no class teacher is found, return null
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: classTeacher?.full_name || null });
  } catch (error) {
    console.error('Error fetching class teacher:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
