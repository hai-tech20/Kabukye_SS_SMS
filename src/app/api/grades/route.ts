import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, withRetry } from '@/lib/supabase';
import { requireSession, requireTeacherOrAdmin, validateScore } from '@/lib/auth-session';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth instanceof NextResponse) return auth;
    const session = auth;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class_id');
    const streamId = searchParams.get('stream_id');
    const term = searchParams.get('term');
    const year = searchParams.get('year');
    const subjectId = searchParams.get('subject_id');
    let studentId = searchParams.get('student_id');
    
    // Also ensure we use academic_year from search params if present (fallback to year)
    const academicYear = searchParams.get('academic_year') || year;

    if (session.role === 'student') {
      if (studentId && studentId !== session.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      studentId = session.id;
    }

    // Determine if this is A-Level (S5/S6)
    const isALevel = classId?.includes('s5') || classId?.includes('s6');

    let query = supabaseAdmin
      .from('grades')
      .select(`
        *,
        students(full_name, schoolpay_code, class_id, stream_id),
        subjects(name, paper_count),
        teachers(full_name),
        grade_papers(paper_number, assessment_type, score)
      `)
      .eq('academic_year', academicYear || '2026')
      .eq('term', term || '1');

    if (classId) query = query.eq('class_id', classId);
    if (streamId) query = query.eq('stream_id', streamId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (studentId) query = query.eq('student_id', studentId);

    const { data, error } = await withRetry(async () => await query.order('created_at', { ascending: false }));

    if (error) throw error;

    // Deduplicate - keep only the most recent grade per student/subject/class/stream/term/year
    const gradeMap = new Map();
    for (const grade of data || []) {
      const key = `${grade.student_id}:${grade.subject_id}:${grade.class_id}:${grade.stream_id}:${grade.term}:${grade.academic_year}`;
      if (!gradeMap.has(key)) {
        gradeMap.set(key, grade);
      }
    }
    const uniqueGrades = Array.from(gradeMap.values());
    
    console.log(`Grades API GET: Retrieved ${data?.length || 0} grades, deduplicated to ${uniqueGrades.length} unique grades`);

    // Transform data (using deduplicated grades)
    const transformedData = (uniqueGrades || []).map(grade => {
      let points = null;
      if (isALevel) {
        // Check if this is a subsidiary subject
        const subjectName = grade.subjects?.name || '';
        const isSubsidiary = 
          subjectName.toLowerCase().includes('general paper') ||
          subjectName.toLowerCase().includes('sub ict') ||
          subjectName.toLowerCase().includes('sub mathematics') ||
          subjectName.toLowerCase().includes('sub math');
        
        if (isSubsidiary) {
          // Subsidiary subjects: D1-C6 = 1 point, P7-P8 = 0, F9 = 0
          switch(grade.grade) {
            case 'D1':
            case 'D2':
            case 'C3':
            case 'C4':
            case 'C5':
            case 'C6':
              points = 1;
              break;
            case 'P7':
            case 'P8':
            case 'F9':
              points = 0;
              break;
          }
        } else {
          // Principal subjects: D1 = 1, D2 = 2, ..., F9 = 9 (lower is better for ranking)
          // Note: In actual UACE, principal subjects use A=6, B=5, etc. but this system uses O-Level grades
          switch(grade.grade) {
            case 'D1': points = 1; break;
            case 'D2': points = 2; break;
            case 'C3': points = 3; break;
            case 'C4': points = 4; break;
            case 'C5': points = 5; break;
            case 'C6': points = 6; break;
            case 'P7': points = 7; break;
            case 'P8': points = 8; break;
            case 'F9': points = 9; break;
          }
        }
      }

      // Map paper scores by MOT/EOT from grade_papers
      const papers = grade.grade_papers || [];
      const p1Mot = grade.p1_score ?? papers.find((p: any) => p.paper_number === 1 && p.assessment_type === 'MOT')?.score;
      const p2Mot = grade.p2_score ?? papers.find((p: any) => p.paper_number === 2 && p.assessment_type === 'MOT')?.score;
      const p3Mot = grade.p3_score ?? papers.find((p: any) => p.paper_number === 3 && p.assessment_type === 'MOT')?.score;
      const p4Mot = grade.p4_score ?? papers.find((p: any) => p.paper_number === 4 && p.assessment_type === 'MOT')?.score;
      const p1Eot = grade.p1_eot_score ?? papers.find((p: any) => p.paper_number === 1 && p.assessment_type === 'EOT')?.score;
      const p2Eot = grade.p2_eot_score ?? papers.find((p: any) => p.paper_number === 2 && p.assessment_type === 'EOT')?.score;
      const p3Eot = grade.p3_eot_score ?? papers.find((p: any) => p.paper_number === 3 && p.assessment_type === 'EOT')?.score;
      const p4Eot = grade.p4_eot_score ?? papers.find((p: any) => p.paper_number === 4 && p.assessment_type === 'EOT')?.score;

      return {
        ...grade,
        points,
        mot_p1: p1Mot,
        mot_p2: p2Mot,
        mot_p3: p3Mot,
        mot_p4: p4Mot,
        eot_p1: p1Eot,
        eot_p2: p2Eot,
        eot_p3: p3Eot,
        eot_p4: p4Eot
      };
    });

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('Error fetching grades:', error);
    return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTeacherOrAdmin();
    if (auth instanceof NextResponse) return auth;
    const session = auth;

    let gradesData: any;
    try {
      gradesData = await request.json();
    } catch (err) {
      console.error('Grades API - Invalid JSON body:', err);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    console.log('Grades API - Received data:', gradesData);
    const teacherId = session.id;
    console.log('Grades API - Teacher ID:', teacherId);

    // Ensure all text fields are strings and trim whitespace
    gradesData = gradesData.map((g: any) => ({
      ...g,
      student_id: String(g.student_id).trim(),
      class_id: String(g.class_id).trim(),
      stream_id: String(g.stream_id).trim(),
      subject_id: String(g.subject_id).trim(),
      term: String(g.term).trim(),
      academic_year: String(g.academic_year).trim()
    }));

    if (!Array.isArray(gradesData) || gradesData.length === 0) {
      return NextResponse.json({ error: 'No grades provided' }, { status: 400 });
    }

    const sampleGrade = gradesData[0];
    const academicYear = sampleGrade.academic_year;
    const term = sampleGrade.term;
    const classId = sampleGrade.class_id;
    const streamId = sampleGrade.stream_id;

    // Trim these too!
    const trimmedAcademicYear = String(academicYear).trim();
    const trimmedTerm = String(term).trim();
    
    const { data: publishedReports, error: publishedError } = await supabaseAdmin
      .from('published_reports')
      .select('id')
      .eq('academic_year', trimmedAcademicYear)
      .eq('term', trimmedTerm)
      .eq('class_id', String(classId).trim())
      .eq('stream_id', String(streamId).trim())
      .limit(1);

    if (publishedError) {
      console.error('Grades API - Published report lookup error:', publishedError);
      throw publishedError;
    }

    if (publishedReports && publishedReports.length > 0) {
      return NextResponse.json(
        { error: 'Cannot edit marks after results have been published for this class and stream.' },
        { status: 403 }
      );
    }

    // Get report settings for weights
    // Try to fetch report settings; use maybeSingle to avoid exceptions when no row
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('report_settings')
      .select('mot_weight, eot_weight, assessment_count, is_published')
      .eq('academic_year', trimmedAcademicYear)
      .eq('term', trimmedTerm)
      .maybeSingle();

    console.log('Grades API - Settings fetch result:', settings, 'Error:', settingsError);

    if (settings && settings.is_published) {
      return NextResponse.json(
        { error: 'Cannot edit marks because this term has been published.' },
        { status: 403 }
      );
    }

    // If settings are not configured, fall back to sensible defaults so teachers
    // can still save marks. This avoids blocking teachers when admin hasn't
    // created report settings for the term.
    const effectiveSettings = settings || { mot_weight: 20, eot_weight: 80, assessment_count: 2, is_published: false };

    const { data: gradingScales, error: scalesError } = await supabaseAdmin
      .from('grading_scales')
      .select('*')
      .order('min_score', { ascending: false });

    console.log('Grades API - Grading scales count:', gradingScales?.length, 'Error:', scalesError);

    if (!gradingScales || gradingScales.length === 0) {
      return NextResponse.json({ error: 'Report settings not configured' }, { status: 400 });
    }

    for (const grade of gradesData) {
      if (session.role === 'teacher') {
        const trimmedTeacherId = String(session.id).trim();
        const trimmedClassId = String(grade.class_id).trim();
        const trimmedStreamId = String(grade.stream_id).trim();
        const trimmedSubjectId = String(grade.subject_id).trim();
        
        // Debug logging: print what we're checking (trimmed) with lengths
        console.log('Grades API: Checking teacher assignment for (trimmed):', {
          teacherId: trimmedTeacherId,
          teacherIdLength: trimmedTeacherId.length,
          classId: trimmedClassId,
          classIdLength: trimmedClassId.length,
          streamId: trimmedStreamId,
          streamIdLength: trimmedStreamId.length,
          subjectId: trimmedSubjectId,
          subjectIdLength: trimmedSubjectId.length
        });
        
        // First get all assignments for this teacher to debug
        const { data: allAssignments } = await supabaseAdmin
          .from('teacher_subjects')
          .select('*')
          .eq('teacher_id', trimmedTeacherId);
        console.log('Grades API: All teacher assignments:', allAssignments?.map(a => ({
          teacher_id: a.teacher_id,
          teacher_id_length: a.teacher_id?.length,
          class_id: a.class_id,
          class_id_length: a.class_id?.length,
          stream_id: a.stream_id,
          stream_id_length: a.stream_id?.length,
          subject_id: a.subject_id,
          subject_id_length: a.subject_id?.length
        })));
        
        // First check if teacher is a class teacher for this class
        const { data: teacherData } = await withRetry(async () =>
          await supabaseAdmin
            .from('teachers')
            .select('id, is_class_teacher, class_teacher_class_id, class_teacher_stream_id')
            .eq('id', trimmedTeacherId)
            .single()
        );

        const isClassTeacher = !!teacherData?.is_class_teacher;
        const classTeacherClassId = teacherData?.class_teacher_class_id?.toLowerCase().trim();
        const isALevelClassTeacher = isClassTeacher && (classTeacherClassId === 's5' || classTeacherClassId === 's6');

        let isAllowed = false;

        if (isClassTeacher && classTeacherClassId === trimmedClassId) {
          if (isALevelClassTeacher) {
            // Allow any stream for A-level class teachers, check subject assignment
            const { data: subjectAssignment } = await withRetry(async () =>
              await supabaseAdmin
                .from('teacher_subjects')
                .select('id')
                .eq('teacher_id', trimmedTeacherId)
                .eq('class_id', trimmedClassId)
                .eq('subject_id', trimmedSubjectId)
                .limit(1)
            );
            isAllowed = subjectAssignment && subjectAssignment.length > 0;
          } else {
            // O-level: check normal stream/subject assignment
            const { data: assignment } = await withRetry(async () =>
              await supabaseAdmin
                .from('teacher_subjects')
                .select('id')
                .eq('teacher_id', trimmedTeacherId)
                .eq('class_id', trimmedClassId)
                .eq('stream_id', trimmedStreamId)
                .eq('subject_id', trimmedSubjectId)
                .limit(1)
            );
            isAllowed = assignment && assignment.length > 0;
          }
        } else {
          // Check if teacher is assigned to this class and subject (any stream!)
          const { data: assignment } = await withRetry(async () =>
            await supabaseAdmin
              .from('teacher_subjects')
              .select('id')
              .eq('teacher_id', trimmedTeacherId)
              .eq('class_id', trimmedClassId)
              .eq('subject_id', trimmedSubjectId)
              .limit(1)
          );
          isAllowed = assignment && assignment.length > 0;
        }

        console.log('Grades API: Assignment check result:', isAllowed);

        if (!isAllowed) {
          return NextResponse.json(
            { error: 'You are not assigned to this class, stream, and subject.' },
            { status: 403 }
          );
        }
      }

      const scoreFields = [
        grade.mot_score,
        grade.eot_score,
        grade.mot_p1,
        grade.eot_p1,
        grade.mot_p2,
        grade.eot_p2,
        grade.mot_p3,
        grade.eot_p3,
        grade.mot_p4,
        grade.eot_p4,
      ];
      for (const s of scoreFields) {
        if (s !== undefined && s !== null && s !== '') {
          const err = validateScore(s);
          if (err) return NextResponse.json({ error: err }, { status: 400 });
        }
      }

      // Use provided mot_score and eot_score directly (already calculated by frontend)
      const motScore = grade.mot_score;
      const eotScore = grade.eot_score;
      
      // Collect individual paper scores for MOT and EOT storage.
      const paperScores = [];
      if (grade.mot_p1 !== undefined && grade.mot_p1 !== null) {
        paperScores.push({ number: 1, assessment_type: 'MOT', score: grade.mot_p1 });
      }
      if (grade.eot_p1 !== undefined && grade.eot_p1 !== null) {
        paperScores.push({ number: 1, assessment_type: 'EOT', score: grade.eot_p1 });
      }
      if (grade.mot_p2 !== undefined && grade.mot_p2 !== null) {
        paperScores.push({ number: 2, assessment_type: 'MOT', score: grade.mot_p2 });
      }
      if (grade.eot_p2 !== undefined && grade.eot_p2 !== null) {
        paperScores.push({ number: 2, assessment_type: 'EOT', score: grade.eot_p2 });
      }
      if (grade.mot_p3 !== undefined && grade.mot_p3 !== null) {
        paperScores.push({ number: 3, assessment_type: 'MOT', score: grade.mot_p3 });
      }
      if (grade.eot_p3 !== undefined && grade.eot_p3 !== null) {
        paperScores.push({ number: 3, assessment_type: 'EOT', score: grade.eot_p3 });
      }
      if (grade.mot_p4 !== undefined && grade.mot_p4 !== null) {
        paperScores.push({ number: 4, assessment_type: 'MOT', score: grade.mot_p4 });
      }
      if (grade.eot_p4 !== undefined && grade.eot_p4 !== null) {
        paperScores.push({ number: 4, assessment_type: 'EOT', score: grade.eot_p4 });
      }

      // Calculate final score if both MOT and EOT exist
      let finalScore: number | null = null;
      let gradeLabel: string | null = null;
      let descriptor: string | null = null;
      
      if (motScore !== undefined && motScore !== null && eotScore !== undefined && eotScore !== null) {
        finalScore = Math.round(
          (motScore * effectiveSettings.mot_weight / 100) +
          (eotScore * effectiveSettings.eot_weight / 100)
        );
        
        // Find grade from grading scale
        const gradeScale = gradingScales.find(
          scale => finalScore! >= scale.min_score && finalScore! <= scale.max_score
        );
        gradeLabel = gradeScale?.grade || 'E';
        descriptor = gradeScale?.descriptor || 'Elementary';
      }

      // 1. Check for existing grade using natural key (ensure all are strings and trimmed)
      const { data: existingGrades, error: lookupError } = await withRetry(async () =>
        await supabaseAdmin
          .from('grades')
          .select('id')
          .eq('student_id', String(grade.student_id).trim())
          .eq('subject_id', String(grade.subject_id).trim())
          .eq('class_id', String(grade.class_id).trim())
          .eq('stream_id', String(grade.stream_id).trim())
          .eq('term', String(grade.term).trim())
          .eq('academic_year', String(grade.academic_year).trim())
          .order('created_at', { ascending: false })
          .limit(1)
      );

      if (lookupError) {
        console.log(`Grades API: Error looking up existing grade for student ${grade.student_id}:`, lookupError);
      }

      const existingGrade = existingGrades && existingGrades.length > 0 ? existingGrades[0] : null;

      // Check if all scores are null/undefined - if so, delete the grade
      const allScoresNull = 
        (motScore === null || motScore === undefined) &&
        (eotScore === null || eotScore === undefined) &&
        (grade.mot_p1 === null || grade.mot_p1 === undefined) &&
        (grade.eot_p1 === null || grade.eot_p1 === undefined) &&
        (grade.mot_p2 === null || grade.mot_p2 === undefined) &&
        (grade.eot_p2 === null || grade.eot_p2 === undefined) &&
        (grade.mot_p3 === null || grade.mot_p3 === undefined) &&
        (grade.eot_p3 === null || grade.eot_p3 === undefined) &&
        (grade.mot_p4 === null || grade.mot_p4 === undefined) &&
        (grade.eot_p4 === null || grade.eot_p4 === undefined);

      if (allScoresNull && existingGrade) {
        // Delete the grade entirely
        console.log(`Grades API: Deleting grade for student ${grade.student_id} because all scores are null`);
        const { error: deleteError } = await withRetry(async () =>
          await supabaseAdmin
            .from('grades')
            .delete()
            .eq('id', existingGrade.id)
        );
        if (deleteError) {
          console.error('Grades API: Error deleting grade:', deleteError);
        }
        // Skip to next grade - no need to save paper scores
        continue;
      }

      // Prepare the data - include null values for fields we want to clear
      const upsertData: any = {
        id: existingGrade ? existingGrade.id : `grade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        student_id: String(grade.student_id).trim(),
        subject_id: String(grade.subject_id).trim(),
        teacher_id: String(teacherId).trim(),
        class_id: String(grade.class_id).trim(),
        stream_id: String(grade.stream_id).trim(),
        term: String(grade.term).trim(),
        academic_year: String(grade.academic_year).trim(),
        mot_score: motScore === null ? null : motScore,
        eot_score: eotScore === null ? null : eotScore,
        final_score: finalScore === null ? null : finalScore,
        grade: gradeLabel === null ? null : gradeLabel,
        descriptor: descriptor === null ? null : descriptor,
        updated_at: new Date().toISOString()
      };

      if (!existingGrade) {
        upsertData.created_at = new Date().toISOString();
      }

      console.log(`Grades API: ${existingGrade ? 'Updating' : 'Creating'} grade for student ${grade.student_id}`);
      console.log("Grades API: upsertData is:", upsertData);
      
      let upsertedGrade;
      let gradeError;

      if (existingGrade) {
        // Update existing grade
        const { data, error } = await withRetry(async () =>
          await supabaseAdmin
            .from('grades')
            .update(upsertData)
            .eq('id', existingGrade.id)
            .select()
        );
        console.log("Grades API: Update response:", data, "Error:", error);
        upsertedGrade = data && data.length > 0 ? data[0] : null;
        gradeError = error;
      } else {
        // Insert new grade only if there are some scores
        if (!allScoresNull) {
          const { data, error } = await withRetry(async () =>
            await supabaseAdmin
              .from('grades')
              .insert(upsertData)
              .select()
          );
          console.log("Grades API: Insert response:", data, "Error:", error);
          upsertedGrade = data && data.length > 0 ? data[0] : null;
          gradeError = error;
        }
      }

      if (gradeError) {
        console.error('Grade upsert error:', gradeError);
        const gradeErrorMessage = gradeError?.message || JSON.stringify(gradeError) || 'Failed to save grade';
        return NextResponse.json({ error: gradeErrorMessage }, { status: 500 });
      }

      // 2. Delete old paper scores for this grade to ensure clean update
      if (upsertedGrade?.id) {
        const { error: deleteError } = await withRetry(async () =>
          await supabaseAdmin
            .from('grade_papers')
            .delete()
            .eq('grade_id', upsertedGrade.id)
        );
        
        if (deleteError) {
          console.error('Error deleting old paper scores:', deleteError);
        }
      }
      
      // 3. Save new individual paper scores if they exist
      if (paperScores.length > 0 && upsertedGrade?.id) {
        const paperData = paperScores.map(ps => ({
          id: crypto.randomUUID(), // use UUID for grade_papers
          grade_id: upsertedGrade.id,
          paper_number: ps.number,
          assessment_type: ps.assessment_type,
          score: ps.score
        }));

        const { data: paperInsertData, error: paperError } = await withRetry(async () =>
          await supabaseAdmin
            .from('grade_papers')
            .upsert(paperData, { onConflict: 'grade_id,paper_number,assessment_type' })
            .select()
        );

        if (paperError) {
          console.error('Paper score insert error:', paperError);
          if (paperError.code === '23505' && paperError.details?.includes('grade_id, paper_number')) {
            return NextResponse.json({
              error: 'grade_papers table is still using the legacy unique constraint on (grade_id, paper_number). Run the grade_papers schema migration to support separate MOT and EOT rows.',
            }, { status: 500 });
          }
          return NextResponse.json({ error: 'Failed to save paper scores' }, { status: 500 });
        }

        console.log('Grades API: saved grade_papers rows:', paperInsertData);
      }
}

    return NextResponse.json({ message: 'Grades saved successfully' });
  } catch (error: any) {
    console.error('Error saving grades:', error);
    const errorMessage = error?.message || error?.toString() || 'Failed to save grades';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
