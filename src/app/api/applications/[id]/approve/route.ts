import { NextRequest, NextResponse } from 'next/server';
import { supabasePublic, supabaseAdmin, withRetry } from '@/lib/supabase';

// POST approve application and create student
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Application ID is required' },
        { status: 400 }
      );
    }

    // Fetch the application
    const { data: application, error: fetchError } = await supabasePublic
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !application) {
      console.error('Error fetching application:', fetchError);
      return NextResponse.json(
        { error: 'Application not found', details: fetchError?.message },
        { status: 404 }
      );
    }

    // Generate student ID (format: KSS-YYYY-XXXX)
    const year = new Date().getFullYear();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const studentId = `KSS-${year}-${randomNum}`;

    // Create student record in sms schema
    const { data: student, error: createError } = await withRetry(async () => {
      return supabaseAdmin
        .from('students')
        .insert([
          {
            student_id: studentId,
            first_name: application.student_full_name.split(' ')[0] || application.student_full_name,
            last_name: application.student_full_name.split(' ').slice(1).join(' ') || '',
            gender: application.gender.toLowerCase(),
            date_of_birth: application.date_of_birth,
            class_id: null, // Will need to be assigned manually
            stream_id: null,
            former_school: application.former_school || null,
            parent_name: application.parent_guardian_full_name || null,
            parent_phone: application.parent_guardian_phone || null,
            password_hash: '$2b$10$9n5Qjby/feDR4BiexE3apedAs1RxXcV0j6gZaUyISZM3n6QWyHDby', // student@kss
            status: 'active',
          },
        ])
        .select()
        .single();
    });

    if (createError) {
      console.error('Error creating student:', createError);
      return NextResponse.json(
        { error: 'Failed to create student', details: createError.message },
        { status: 500 }
      );
    }

    // Delete the application after successful creation
    const { error: deleteError } = await supabasePublic
      .from('applications')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting application after approval:', deleteError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json(
      { 
        message: 'Application approved and student created successfully',
        student,
        studentId
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
