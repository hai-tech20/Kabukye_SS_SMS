import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

// Helper function to validate teacher ID
function validateTeacherId(id: string): boolean {
  return typeof id === 'string' && id.length > 0;
}

// Helper function to filter out null/undefined values
function filterValidData(data: any): any {
  const filtered: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
      filtered[key] = data[key];
    }
  });
  return filtered;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teacherId = params.id;
    
    // Validate teacher ID
    if (!validateTeacherId(teacherId)) {
      return NextResponse.json({ error: 'Invalid teacher ID' }, { status: 400 });
    }
    
    const { data, error } = await supabaseAdmin
      .from('teachers')
      .select(`
        *,
        teacher_subjects(
          id,
          classes(name),
          streams(name),
          subjects(name)
        )
      `)
      .eq('id', teacherId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching teacher:', error);
    return NextResponse.json({ error: 'Failed to fetch teacher' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    console.log('PUT /api/teachers/' + id + ' - Starting update');
    
    // Validate teacher ID
    if (!validateTeacherId(id)) {
      console.log('Invalid teacher ID:', id);
      return NextResponse.json({ error: 'Invalid teacher ID' }, { status: 400 });
    }
    
    const contentType = request.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    let teacherData: any = {
      updated_at: new Date().toISOString()
    };

    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (from edit form)
      const formData = await request.formData();
      
      const rawTeacherData = {
        full_name: formData.get('full_name'),
        teacher_code: formData.get('teacher_code'),
        email: formData.get('email'),
        role: formData.get('role'),
        phone: formData.get('phone'),
        gender: formData.get('gender'),
        is_class_teacher: formData.get('is_class_teacher'),
        class_teacher_class_id: formData.get('class_teacher_class_id'),
        class_teacher_stream_id: formData.get('class_teacher_stream_id')
      };
      
      // Filter out null/undefined values
      teacherData = {
        ...teacherData,
        ...filterValidData(rawTeacherData)
      };
      console.log('Teacher data after filtering:', Object.keys(teacherData));

      // Handle email specifically - allow empty string to be set to null
      if (rawTeacherData.email === '') {
        teacherData.email = null;
      }

      // Validate phone if it's being updated
      if (rawTeacherData.phone !== undefined && rawTeacherData.phone !== null && rawTeacherData.phone === '') {
        return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
      }

      // Handle boolean conversion
      if (teacherData.is_class_teacher !== undefined) {
        teacherData.is_class_teacher = teacherData.is_class_teacher === 'true';
      }

      // Handle password change
      const password = formData.get('password') as string;
      if (password && password.trim() !== '') {
        teacherData.password_hash = await bcrypt.hash(password, 10);
      }

      // Handle photo upload
      const photo = formData.get('photo') as File;
      if (photo && photo.size > 0) {
        try {
          const fileExt = photo.name.split('.').pop() || 'jpg';
          const fileName = `${id}.${fileExt}`;
          const filePath = `teachers/${fileName}`;
          
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('photos')
            .upload(filePath, photo, {
              contentType: photo.type,
              upsert: true
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('photos')
            .getPublicUrl(filePath);
          teacherData.photo_url = publicUrl;
        } catch (photoError) {
          console.error('Photo upload failed:', photoError);
          // Continue without photo - don't fail the entire update
        }
      }

      // Handle subject assignments update
      const subjectAssignmentsJson = formData.get('subject_assignments') as string;
      console.log('PUT: Subject assignments JSON:', subjectAssignmentsJson ? 'present' : 'not present');
      if (subjectAssignmentsJson) {
        try {
          const subjectAssignments = JSON.parse(subjectAssignmentsJson);
          console.log('PUT: Parsed subject assignments:', subjectAssignments);
          
          // Delete existing subject assignments
          await supabaseAdmin
            .from('teacher_subjects')
            .delete()
            .eq('teacher_id', id);
          
          // Insert new subject assignments (filter out empty ones)
          const validAssignments = subjectAssignments.filter(
            (sa: any) => sa.subject_id && sa.class_id && sa.stream_id
          );
          console.log('PUT: Valid assignments to insert:', validAssignments);
          
          if (validAssignments.length > 0) {
            const assignmentsToInsert = validAssignments.map((sa: any) => ({
              id: `tsub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              teacher_id: id,
              subject_id: sa.subject_id,
              class_id: sa.class_id,
              stream_id: sa.stream_id
            }));
            
            const { error: subjectError } = await supabaseAdmin
              .from('teacher_subjects')
              .insert(assignmentsToInsert);
            
            if (subjectError) {
              console.error('PUT: Error saving teacher subjects:', subjectError);
            } else {
              console.log('PUT: Subject assignments saved successfully');
            }
          } else {
            console.log('PUT: No valid assignments to insert');
          }
        } catch (subjectParseError) {
          console.error('PUT: Error parsing subject assignments:', subjectParseError);
        }
      } else {
        console.log('PUT: No subject assignments data in form');
      }
    } else {
      // Handle JSON (for archive action)
      const body = await request.json();
      teacherData = { ...teacherData, ...filterValidData(body) };
    }

    // Check if there's anything to update
    console.log('Final teacherData keys:', Object.keys(teacherData));
    if (Object.keys(teacherData).length <= 1) { // Only updated_at
      console.log('No valid data to update');
      return NextResponse.json({ error: 'No valid data to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('teachers')
      .update(teacherData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data, message: 'Teacher updated successfully' });
  } catch (error) {
    console.error('Error updating teacher:', error);
    console.error('Error stack:', (error as Error).stack);
    return NextResponse.json({ error: 'Failed to update teacher', details: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teacherId = params.id;
    
    // Validate teacher ID
    if (!validateTeacherId(teacherId)) {
      return NextResponse.json({ error: 'Invalid teacher ID' }, { status: 400 });
    }
    
    // Check if teacher exists before deleting
    const { data: existingTeacher, error: fetchError } = await supabaseAdmin
      .from('teachers')
      .select('id, full_name')
      .eq('id', teacherId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
      }
      throw fetchError;
    }
    
    // Delete the teacher
    const { error } = await supabaseAdmin
      .from('teachers')
      .delete()
      .eq('id', teacherId);

    if (error) throw error;

    return NextResponse.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    return NextResponse.json({ error: 'Failed to delete teacher' }, { status: 500 });
  }
}
