import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-session';

// GET - Fetch student subjects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const classId = searchParams.get('class_id');

    let query = supabaseAdmin
      .from('student_subjects')
      .select(`
        id,
        student_id,
        subject_id,
        subject_type,
        is_principal,
        is_active,
        subjects(id, name, subject_type),
        students(id, full_name, class_id, stream_id, subject_combination)
      `);

    if (studentId) {
      query = query.eq('student_id', studentId);
    } else if (classId) {
      query = query.eq('students.class_id', classId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching student subjects:', error);
    return NextResponse.json({ error: 'Failed to fetch student subjects' }, { status: 500 });
  }
}

// POST - Assign subjects to student
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, subjects, combination_code } = body;

    if (!student_id || !subjects || !Array.isArray(subjects)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // First, deactivate existing subjects for this student
    const { error: deactivateError } = await supabaseAdmin
      .from('student_subjects')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('student_id', student_id);

    if (deactivateError) {
      console.error('Error deactivating existing subjects:', deactivateError);
    }

    // Insert new subject assignments
    const subjectsToInsert = subjects.map((subject: any) => ({
      student_id: subject.student_id,
      subject_id: subject.subject_id,
      subject_type: subject.subject_type,
      is_principal: subject.subject_type === 'principal',
      is_active: true
    }));

    const { data, error } = await supabaseAdmin
      .from('student_subjects')
      .upsert(subjectsToInsert, { onConflict: 'student_id,subject_id' })
      .select();

    if (error) throw error;

    // Update student's subject combination
    if (combination_code) {
      await supabaseAdmin
        .from('students')
        .update({ subject_combination: combination_code, updated_at: new Date().toISOString() })
        .eq('id', student_id);
    }

    return NextResponse.json({ 
      data, 
      message: 'Subjects assigned successfully',
      count: subjects.length 
    });
  } catch (error: any) {
    console.error('Error assigning subjects:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to assign subjects' 
    }, { status: 500 });
  }
}

// PUT - Update student subject
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, is_active, subject_type } = body;

    if (!id) {
      return NextResponse.json({ error: 'Subject assignment ID required' }, { status: 400 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (is_active !== undefined) updateData.is_active = is_active;
    if (subject_type) updateData.subject_type = subject_type;

    const { data, error } = await supabaseAdmin
      .from('student_subjects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data, message: 'Subject assignment updated' });
  } catch (error: any) {
    console.error('Error updating subject assignment:', error);
    return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 });
  }
}

// DELETE - Remove subject from student
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Subject assignment ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('student_subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Subject removed successfully' });
  } catch (error: any) {
    console.error('Error removing subject:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove subject' }, { status: 500 });
  }
}
