import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const term = searchParams.get('term');
    const year = searchParams.get('year');

    if (!studentId || !term || !year) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
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

    // commentsError is ok if no comments exist

    return NextResponse.json({
      data: {
        student,
        grades: grades || [],
        comments: comments || null
      }
    });
  } catch (error) {
    console.error('Error fetching report data:', error);
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}
