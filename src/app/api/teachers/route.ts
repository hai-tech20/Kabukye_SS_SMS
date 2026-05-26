import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { requireAdminSession } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (auth instanceof NextResponse) return auth;
    const { data, error } = await supabaseAdmin
      .from('teachers')
      .select(`
        *,
        teacher_subjects(
          id,
          subject_id,
          class_id,
          stream_id,
          subjects(name),
          classes(name),
          streams(name)
        )
      `)
      .eq('status', 'active')
      .order('full_name', { ascending: true }); // Alphabetical order by name

    if (error) throw error;

    console.log('Teachers fetched:', data?.length);
    data?.forEach((t: any) => {
      console.log(`Teacher ${t.full_name} has ${t.teacher_subjects?.length || 0} subject assignments`);
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (auth instanceof NextResponse) return auth;

    const formData = await request.formData();
    
    const teacherData: any = {
      id: `teacher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      full_name: formData.get('full_name'),
      teacher_code: formData.get('teacher_code'),
      email: formData.get('email') || null,
      phone: formData.get('phone'),
      role: formData.get('role') || 'teacher',
      is_class_teacher: formData.get('is_class_teacher') === 'true',
      class_teacher_class_id: formData.get('class_teacher_class_id') || null,
      class_teacher_stream_id: formData.get('class_teacher_stream_id') || null,
      status: 'active'
    };

    // Handle password according to rule: first 4 letters of name + teacher_code
    const fullName = teacherData.full_name as string;
    const teacherCode = teacherData.teacher_code as string;
    const phone = teacherData.phone as string;
    
    if (!fullName || !teacherCode || !phone) {
      return NextResponse.json({ error: 'Full name, teacher code, and phone are required' }, { status: 400 });
    }
    
    // Default password rule: first 4 letters of name (lowercase) + teacher_code
    const namePart = fullName.replace(/\s+/g, '').substring(0, 4).toLowerCase();
    const defaultPassword = `${namePart}${teacherCode}`;
    
    // Use manual password if provided, otherwise use default rule
    const manualPassword = formData.get('password') as string;
    const finalPassword = manualPassword || defaultPassword;
    
    teacherData.password_hash = await bcrypt.hash(finalPassword, 10);

    // Handle photo upload if present
    const photo = formData.get('photo') as File;
    if (photo && photo.size > 0) {
      try {
        const fileExt = photo.name.split('.').pop() || 'jpg';
        const fileName = `${teacherData.id}.${fileExt}`;
        const filePath = `teachers/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('photos')
          .upload(filePath, photo, {
            contentType: photo.type,
            upsert: true
          });
        
        if (uploadError) {
          console.error('Photo upload error:', uploadError);
        } else {
          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('photos')
            .getPublicUrl(filePath);
          teacherData.photo_url = publicUrl;
        }
      } catch (uploadErr) {
        console.error('Photo upload failed:', uploadErr);
      }
    }

    console.log('Adding teacher with password:', finalPassword);

    // Insert teacher first
    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .insert(teacherData)
      .select()
      .single();

    if (teacherError) throw teacherError;

    // Handle subject assignments
    try {
      const subjectAssignments = JSON.parse(formData.get('subject_assignments') as string);
      console.log('POST: Subject assignments received:', subjectAssignments);
      
      // Handle subject assignments
      for (const assignment of subjectAssignments) {
        if (assignment.subject_id && assignment.class_id && assignment.stream_id) {
          console.log('POST: Inserting assignment:', assignment);
          const { error: subjectError } = await supabaseAdmin
            .from('teacher_subjects')
            .insert({
              id: `tsub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              teacher_id: teacher.id,
              class_id: assignment.class_id,
              stream_id: assignment.stream_id,
              subject_id: assignment.subject_id
            });
          if (subjectError) {
            console.error('POST: Error inserting subject assignment:', subjectError);
          }
        }
      }
    } catch (subjectError) {
      console.error('POST: Error handling subject assignments:', subjectError);
      // Don't fail the entire request - teacher was already created
    }

    return NextResponse.json({ data: teacher, message: 'Teacher added successfully' });
  } catch (error) {
    console.error('Error adding teacher:', error);
    return NextResponse.json({ error: 'Failed to add teacher' }, { status: 500 });
  }
}
