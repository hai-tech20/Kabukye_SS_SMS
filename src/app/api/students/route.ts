import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, withRetry } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import {
  getSession,
  requireSession,
  requireAdminSession,
  validateImageFile,
  sanitizeSearchInput,
} from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;
    const session = auth;

    if (session.role === 'student') {
      const { data: self, error: selfError } = await supabaseAdmin
        .from('students')
        .select(`*, classes!left(name), streams!left(name)`)
        .eq('id', session.id)
        .single();
      if (selfError || !self) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      return NextResponse.json({
        data: [self],
        pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
      });
    }
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class_id');
    const streamId = searchParams.get('stream_id');
    const subjectId = searchParams.get('subject_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const search = sanitizeSearchInput(searchParams.get('search'));

    const normalizedClassId = classId?.toLowerCase().trim() || undefined;
    const normalizedStreamId = streamId?.toLowerCase().trim() || undefined;

    // Check if A-level class (S5 or S6) - for subject filtering
    const isALevel = normalizedClassId?.includes('s5') || normalizedClassId?.includes('s6');
    console.log(`Students API: classId=${classId}, subjectId=${subjectId}, isALevel=${isALevel}`);

    // For A-level, resolve the correct subject ID based on student's actual class
    let resolvedSubjectId = subjectId;
    if (isALevel && subjectId && classId) {
      console.log(`Students API: Checking if subject ${subjectId} needs resolution for class ${classId}`);
      
      // First check if the subject ID already matches the class (e.g., a-phys-s5 for s5)
      const subjectClassMatch = subjectId.toLowerCase().includes(classId.toLowerCase());
      console.log(`Students API: Subject ${subjectId} matches class ${classId}: ${subjectClassMatch}`);
      
      // Only resolve if the subject ID doesn't match the class
      // This handles cases like a-phys-s6 assigned to s5 class, or a-phys-s5 assigned to s6 class
      if (!subjectClassMatch) {
        console.log(`Students API: Resolving subject ${subjectId} for class ${classId}`);
        // Look up the subject name from the given subject_id
        const { data: subjectData, error: subjectError } = await withRetry(async () =>
          await supabaseAdmin
            .from('subjects')
            .select('name')
            .eq('id', subjectId)
            .single()
        );
        
        if (subjectError) {
          console.log(`Students API: Error looking up subject ${subjectId}:`, subjectError);
        } else if (subjectData?.name) {
          console.log(`Students API: Found subject name: ${subjectData.name}`);
          // Find the matching subject for the target class (e.g., a-phys-s6 for s6 class)
          // Use limit(1) instead of single() because there might be multiple subjects with same name
          const { data: classSubjects, error: classSubjectError } = await supabaseAdmin
            .from('subjects')
            .select('id')
            .eq('name', subjectData.name)
            .eq('class_id', classId)
            .limit(1);
          
          if (classSubjectError) {
            console.log(`Students API: Error finding subject for class ${classId}:`, classSubjectError);
          } else if (classSubjects && classSubjects.length > 0) {
            resolvedSubjectId = classSubjects[0].id;
            console.log(`Students API: Resolved subject ${subjectId} (${subjectData.name}) to ${resolvedSubjectId} for class ${classId}`);
          } else {
            console.log(`Students API: No matching subject found for ${subjectData.name} in class ${classId}`);
          }
        } else {
          console.log(`Students API: No subject found for ${subjectId}`);
        }
      } else {
        console.log(`Students API: No resolution needed - subject ${subjectId} already matches class ${classId}`);
      }
    }

    let query;
    
    // For A-level with subject filter, join with student_subjects
    if (isALevel && resolvedSubjectId) {
      console.log(`Students API: Using A-level subject filter for ${resolvedSubjectId} (original: ${subjectId}), classId=${classId}, streamId=${streamId}`);
      query = supabaseAdmin
        .from('students')
        .select(`
          *,
          classes!left(name),
          streams!left(name),
          student_subjects!inner(subject_id)
        `)
        .eq('student_subjects.subject_id', resolvedSubjectId);
      
      // Apply class and stream filters immediately for A-level
      if (normalizedClassId) {
        query = query.ilike('class_id', normalizedClassId);
      }
      if (normalizedStreamId) {
        query = query.ilike('stream_id', normalizedStreamId);
      }
    } else {
      console.log(`Students API: Using standard query (no A-level subject filter)`);
      query = supabaseAdmin
        .from('students')
        .select(`
          *,
          classes!left(name),
          streams!left(name)
        `);
    }

    // If user is teacher, restrict to their assigned classes and streams
    if (session?.role === 'teacher') {
      const { data: teacherAssignments } = await withRetry(async () =>
        await supabaseAdmin
          .from('teacher_subjects')
          .select('class_id, stream_id')
          .eq('teacher_id', session.id)
      );

      if (teacherAssignments && teacherAssignments.length > 0) {
        // Build OR conditions for each (class_id, stream_id) pair
        // A teacher assigned to class s5 + stream A should only see students in that specific combination
        const uniqueAssignments = [...new Set(teacherAssignments.map(a => `${a.class_id}:${a.stream_id}`))];
        console.log(`Students API: Teacher assignments:`, uniqueAssignments);
        
        // If classId and streamId are provided, verify teacher has access
        if (classId && streamId) {
          const hasAccess = uniqueAssignments.some(a => a === `${classId}:${streamId}`);
          console.log(`Students API: Checking access for ${classId}:${streamId} - hasAccess: ${hasAccess}`);
          if (!hasAccess) {
            console.log(`Students API: Access denied - teacher not assigned to ${classId}:${streamId}`);
            return NextResponse.json({
              data: [],
              pagination: { page, limit, total: 0, totalPages: 0 }
            });
          }
        } else if (classId) {
          // Only class provided - check if teacher has any assignment in this class
          const hasClassAccess = teacherAssignments.some(a => a.class_id === classId);
          console.log(`Students API: Checking class access for ${classId} - hasClassAccess: ${hasClassAccess}`);
          if (!hasClassAccess) {
            console.log(`Students API: Access denied - teacher not assigned to class ${classId}`);
            return NextResponse.json({
              data: [],
              pagination: { page, limit, total: 0, totalPages: 0 }
            });
          }
        }
      } else {
        // Teacher has no assignments, return empty result
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0
          }
        });
      }
    }

    // Apply filters (skip class/stream for A-level with subject filter as they're already applied above)
    if (!(isALevel && subjectId) && normalizedClassId) {
      query = query.ilike('class_id', normalizedClassId);
    }
    if (!(isALevel && subjectId) && normalizedStreamId) {
      query = query.ilike('stream_id', normalizedStreamId);
    }
    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }
    
    console.log(`Students API: Fetching students - classId: ${classId}, streamId: ${streamId}, role: ${session?.role}, teacherId: ${session?.id}`);

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1)
      .order('full_name', { ascending: true }); // Alphabetical order by name

    let { data, error } = await withRetry(async () => await query);

    if (error) {
      console.error('Students API error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch students', 
        details: error 
      }, { status: 500 });
    }

    // Count actual data length for accurate count
    let actualCount = data?.length || 0;
    console.log(`Students API: Retrieved ${actualCount} students for classId=${classId}, streamId=${streamId}, resolvedSubjectId=${resolvedSubjectId}, original=${subjectId}`);
    
    // If no students found with resolved ID, try original subject ID (fallback for mismatched data)
    if (actualCount === 0 && isALevel && resolvedSubjectId !== subjectId) {
      console.log(`Students API: No students with resolved ID ${resolvedSubjectId}, trying original ${subjectId}`);
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('students')
        .select(`
          *,
          classes!left(name),
          streams!left(name),
          student_subjects!inner(subject_id)
        `)
        .eq('student_subjects.subject_id', subjectId)
        .eq('class_id', classId)
        .eq('stream_id', streamId)
        .order('full_name', { ascending: true });
      
      if (!fallbackError && fallbackData && fallbackData.length > 0) {
        data = fallbackData;
        actualCount = fallbackData.length;
        console.log(`Students API: Fallback successful - found ${actualCount} students with original subject ID ${subjectId}`);
      } else {
        console.log(`Students API: Fallback also returned 0 students`);
      }
    }
    
    // If still no students, try with base subject code (e.g., 'a-hist' instead of 'a-hist-s5')
    if (actualCount === 0 && isALevel && subjectId) {
      const baseSubjectMatch = subjectId.match(/^([a-z]+-[a-z]+)-s\d+$/);
      if (baseSubjectMatch) {
        const baseSubjectId = baseSubjectMatch[1];
        console.log(`Students API: Trying base subject ID ${baseSubjectId}`);
        const { data: baseData, error: baseError } = await supabaseAdmin
          .from('students')
          .select(`
            *,
            classes!left(name),
            streams!left(name),
            student_subjects!inner(subject_id)
          `)
          .ilike('student_subjects.subject_id', `${baseSubjectId}-%`)
          .eq('class_id', classId)
          .eq('stream_id', streamId)
          .order('full_name', { ascending: true });
        
        if (!baseError && baseData && baseData.length > 0) {
          data = baseData;
          actualCount = baseData.length;
          console.log(`Students API: Base subject fallback successful - found ${actualCount} students`);
        }
      }
    }
    
    if (actualCount === 0 && isALevel && subjectId) {
      console.log(`Students API: DEBUG - No students found. Checking if students exist in class ${classId} stream ${streamId}`);
      const { data: checkData, error: checkError } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('class_id', classId)
        .eq('stream_id', streamId);
      if (checkError) {
        console.error('Students API error checking students:', checkError);
      } else {
        console.log(`Students API: Found ${checkData?.length || 0} students in class ${classId} stream ${streamId}`);
      }
      
      // Check what subjects these students are enrolled in
      const { data: subjectData, error: subjectError } = await supabaseAdmin
        .from('student_subjects')
        .select('subject_id, student_id')
        .in('student_id', checkData?.map((s: any) => s.id) || []);
      if (subjectError) {
        console.error('Students API error checking subjects:', subjectError);
      } else {
        console.log(`Students API: Students in ${classId} are enrolled in subjects:`, [...new Set(subjectData?.map((s: any) => s.subject_id))]);
      }
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: actualCount,
        totalPages: Math.ceil(actualCount / limit)
      }
    });

  } catch (error) {
    console.error('Students API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (auth instanceof NextResponse) return auth;

    const formData = await request.formData();
    
    // Extract data from FormData
    const studentData = {
      full_name: formData.get('full_name') as string,
      class_id: formData.get('class_id') as string,
      stream_id: formData.get('stream_id') as string,
      gender: formData.get('gender') as string,
      date_of_birth: formData.get('date_of_birth') as string,
      subject_combination: formData.get('subject_combination') as string,
      schoolpay_code: formData.get('schoolpay_code') as string,
      guardian_name: formData.get('guardian_name') as string,
      guardian_phone: formData.get('guardian_phone') as string,
      photo: formData.get('photo') as File
    };

    // Validate required fields
    const requiredFields = ['full_name', 'class_id', 'stream_id', 'gender', 'schoolpay_code', 'guardian_name', 'guardian_phone'];
    const missingFields = requiredFields.filter(field => !studentData[field as keyof typeof studentData]);
    
    if (missingFields.length > 0) {
      return NextResponse.json({ 
        error: 'Missing required fields', 
        missing: missingFields 
      }, { status: 400 });
    }

    // Generate student ID
    const studentId = `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Generate password for student (using schoolpay_code as default password)
    const defaultPassword = studentData.schoolpay_code;
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // Handle photo upload if present
    let photo_url = null;
    console.log('Checking for photo upload. Photo present:', !!studentData.photo, 'Size:', studentData.photo?.size);
    
    if (studentData.photo && studentData.photo.size > 0) {
      const photoError = validateImageFile(studentData.photo);
      if (photoError) {
        return NextResponse.json({ error: photoError }, { status: 400 });
      }
      try {
        const fileExt = studentData.photo.name.split('.').pop() || 'jpg';
        const fileName = `${studentId}.${fileExt}`;
        const filePath = `students/${fileName}`;
        
        console.log('Uploading photo:', fileName, 'Size:', studentData.photo.size, 'Type:', studentData.photo.type);
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('student-photos')
          .upload(filePath, studentData.photo, {
            contentType: studentData.photo.type,
            upsert: true
          });
        
        if (uploadError) {
          console.error('Photo upload error:', uploadError);
        } else {
          // Get public URL
          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('student-photos')
            .getPublicUrl(filePath);
          photo_url = publicUrl;
          console.log('Photo uploaded successfully. URL:', photo_url);
        }
      } catch (uploadErr) {
        console.error('Photo upload failed:', uploadErr);
      }
    } else {
      console.log('No photo to upload');
    }

    const { data, error } = await supabaseAdmin
      .from('students')
      .insert({
        id: studentId,
        full_name: studentData.full_name,
        class_id: studentData.class_id,
        stream_id: studentData.stream_id,
        gender: studentData.gender,
        date_of_birth: studentData.date_of_birth || null,
        subject_combination: studentData.subject_combination || null,
        schoolpay_code: studentData.schoolpay_code,
        guardian_name: studentData.guardian_name,
        guardian_phone: studentData.guardian_phone,
        photo_url: photo_url,
        password_hash: passwordHash
      })
      .select()
      .single();

    if (error) {
      console.error('Student creation error:', error);
      return NextResponse.json({ 
        error: 'Failed to create student', 
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Student added successfully',
      data: data
    });

  } catch (error) {
    console.error('Student creation unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
