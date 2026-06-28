import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import {
  requireSession,
  requireAdminSession,
  assertStudentSelf,
  validateImageFile,
} from '@/lib/auth-session';

// Helper function to validate student ID
function validateStudentId(id: string): boolean {
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
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;

    const studentId = params.id;
    const denied = assertStudentSelf(auth, studentId);
    if (denied) return denied;
    
    // Validate student ID
    if (!validateStudentId(studentId)) {
      return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
    }
    
    const { data, error } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        classes(name),
        streams(name)
      `)
      .eq('id', studentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminSession();
    if (auth instanceof NextResponse) return auth;

    const id = params.id;
    
    // Validate student ID
    if (!validateStudentId(id)) {
      return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
    }
    
    const contentType = request.headers.get('content-type');
    
    let studentData: any = {
      updated_at: new Date().toISOString()
    };

    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (from edit form)
      const formData = await request.formData();
      
      const rawStudentData = {
        full_name: formData.get('full_name'),
        gender: formData.get('gender'),
        date_of_birth: formData.get('date_of_birth'),
        class_id: formData.get('class_id'),
        stream_id: formData.get('stream_id'),
        schoolpay_code: formData.get('schoolpay_code'),
        guardian_name: formData.get('guardian_name'),
        guardian_phone: formData.get('guardian_phone'),
        subject_combination: formData.get('subject_combination')
      };
      
      // Filter out null/undefined values
      studentData = {
        ...studentData,
        ...filterValidData(rawStudentData)
      };

      // Handle password change
      const password = formData.get('password') as string;
      if (password && password.trim() !== '') {
        studentData.password_hash = await bcrypt.hash(password, 10);
      }

      // Handle photo upload
      const photo = formData.get('photo') as File;
      console.log('PUT: Checking photo. Present:', !!photo, 'Size:', photo?.size, 'Type:', photo?.type);
      
      if (photo && photo.size > 0) {
        try {
          const fileName = `${id}.jpg`;
          const filePath = `students/${fileName}`;
          
          console.log('PUT: Uploading photo to path:', filePath, 'Name:', photo.name);
          
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('student-photos')
            .upload(filePath, photo, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.error('PUT: Photo upload error:', uploadError);
            throw uploadError;
          }

          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('student-photos')
            .getPublicUrl(filePath);
          studentData.photo_url = publicUrl;
          console.log('PUT: Photo uploaded successfully. URL:', publicUrl);
        } catch (photoError) {
          console.error('PUT: Photo upload failed:', photoError);
          // Continue without photo - don't fail the entire update
        }
      } else {
        console.log('PUT: No photo to upload');
      }
    } else {
      // Handle JSON (for archive action)
      const body = await request.json();
      studentData = { ...studentData, ...filterValidData(body) };
    }

    // Check if there's anything to update
    if (Object.keys(studentData).length <= 1) { // Only updated_at
      return NextResponse.json({ error: 'No valid data to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('students')
      .update(studentData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data, message: 'Student updated successfully' });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminSession();
    if (auth instanceof NextResponse) return auth;

    const studentId = params.id;
    
    // Validate student ID
    if (!validateStudentId(studentId)) {
      return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
    }
    
    // Check if student exists and get photo_url
    const { data: existingStudent, error: fetchError } = await supabaseAdmin
      .from('students')
      .select('id, photo_url')
      .eq('id', studentId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      throw fetchError;
    }
    
    // Delete photo from storage if it exists
    if (existingStudent?.photo_url) {
      try {
        // Extract file path from the photo_url
        const photoUrl = existingStudent.photo_url;
        const urlParts = photoUrl.split('/');
        const bucketName = 'student-photos';
        const filePathIndex = urlParts.indexOf(bucketName) + 1;
        
        if (filePathIndex > 0) {
          const filePath = urlParts.slice(filePathIndex).join('/');
          console.log('Deleting photo from storage:', filePath);
          
          const { error: storageError } = await supabaseAdmin.storage
            .from(bucketName)
            .remove([filePath]);
          
          if (storageError) {
            console.error('Error deleting photo from storage:', storageError);
            // Continue with student deletion even if photo deletion fails
          } else {
            console.log('Photo deleted successfully from storage');
          }
        }
      } catch (storageErr) {
        console.error('Failed to delete photo from storage:', storageErr);
        // Continue with student deletion even if photo deletion fails
      }
    }
    
    // Delete the student
    const { error } = await supabaseAdmin
      .from('students')
      .delete()
      .eq('id', studentId);

    if (error) throw error;

    return NextResponse.json({ message: 'Student and photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
  }
}
