import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, withRetry } from '@/lib/supabase';
import { getSession } from '@/lib/auth-session';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class_id');
    const streamId = searchParams.get('stream_id');
    const term = searchParams.get('term');
    const year = searchParams.get('year');
    const subjectId = searchParams.get('subject_id');
    const studentId = searchParams.get('student_id');

    // Determine if this is A-Level (S5/S6)
    const isALevel = classId?.includes('s5') || classId?.includes('s6');

    let query = supabaseAdmin
      .from('grades')
      .select(`
        *,
        students(full_name, schoolpay_code, class_id, stream_id),
        subjects(name, paper_count),
        teachers(full_name),
        grade_papers(paper_number, score)
      `)
      .eq('academic_year', year || '2026')
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

      // Map paper scores
      const papers = grade.grade_papers || [];
      const p1 = papers.find((p: any) => p.paper_number === 1)?.score;
      const p2 = papers.find((p: any) => p.paper_number === 2)?.score;
      const p3 = papers.find((p: any) => p.paper_number === 3)?.score;

      return {
        ...grade,
        points,
        p1_score: p1,
        p2_score: p2,
        p3_score: p3
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
    const gradesData = await request.json();
    console.log('Grades API - Received data:', gradesData);
    
    // Get teacher ID from session
    const session = await getSession();
    console.log('Grades API - Session:', session);
    
    if (!session || (session.role !== 'teacher' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const teacherId = session.id;
    console.log('Grades API - Teacher ID:', teacherId);

    if (!Array.isArray(gradesData) || gradesData.length === 0) {
      return NextResponse.json({ error: 'No grades provided' }, { status: 400 });
    }

    const sampleGrade = gradesData[0];
    const academicYear = sampleGrade.academic_year;
    const term = sampleGrade.term;
    const classId = sampleGrade.class_id;
    const streamId = sampleGrade.stream_id;

    const { data: publishedReports, error: publishedError } = await supabaseAdmin
      .from('published_reports')
      .select('id')
      .eq('academic_year', academicYear)
      .eq('term', term)
      .eq('class_id', classId)
      .eq('stream_id', streamId)
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
      .eq('academic_year', academicYear)
      .eq('term', term)
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
    const effectiveSettings = settings || { mot_weight: 40, eot_weight: 60, assessment_count: 2, is_published: false };

    const { data: gradingScales, error: scalesError } = await supabaseAdmin
      .from('grading_scales')
      .select('*')
      .order('min_score', { ascending: false });

    console.log('Grades API - Grading scales count:', gradingScales?.length, 'Error:', scalesError);

    if (!gradingScales || gradingScales.length === 0) {
      return NextResponse.json({ error: 'Report settings not configured' }, { status: 400 });
    }

    for (const grade of gradesData) {
      // Use provided mot_score and eot_score directly (already calculated by frontend)
      const motScore = grade.mot_score;
      const eotScore = grade.eot_score;
      
      // Collect paper scores for storage
      const paperScores = [];
      if (grade.p1_score !== undefined && grade.p1_score !== null) {
        paperScores.push({ number: 1, score: grade.p1_score });
      }
      if (grade.p2_score !== undefined && grade.p2_score !== null) {
        paperScores.push({ number: 2, score: grade.p2_score });
      }
      if (grade.p3_score !== undefined && grade.p3_score !== null) {
        paperScores.push({ number: 3, score: grade.p3_score });
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

      // 1. Check for existing grade by student/subject/class/stream/term/year with retry
      const { data: existingGrades, error: lookupError } = await withRetry(async () =>
        await supabaseAdmin
          .from('grades')
          .select('id')
          .eq('student_id', grade.student_id)
          .eq('subject_id', grade.subject_id)
          .eq('class_id', grade.class_id)
          .eq('stream_id', grade.stream_id)
          .eq('term', grade.term)
          .eq('academic_year', grade.academic_year)
          .order('created_at', { ascending: false })
          .limit(1)
      );
      
      if (lookupError) {
        console.log(`Grades API: Error looking up existing grade for student ${grade.student_id}:`, lookupError);
      }
      
      const existingGrade = existingGrades && existingGrades.length > 0 ? existingGrades[0] : null;
      
      // Use existing ID if found, otherwise generate new one
      const gradeId = existingGrade?.id || crypto.randomUUID();
      
      console.log(`Grades API: ${existingGrade ? 'Found existing grade' : 'No existing grade'} for student ${grade.student_id}, using ID: ${gradeId}`);
      
      const upsertData: any = {
        id: gradeId,
        student_id: grade.student_id,
        subject_id: grade.subject_id,
        teacher_id: teacherId,
        class_id: grade.class_id,
        stream_id: grade.stream_id,
        term: grade.term,
        academic_year: grade.academic_year,
        assessment_count: effectiveSettings.assessment_count
      };
      
      // Only include scores if they exist
      if (motScore !== undefined && motScore !== null) upsertData.mot_score = motScore;
      if (eotScore !== undefined && eotScore !== null) upsertData.eot_score = eotScore;
      if (finalScore !== null) upsertData.final_score = finalScore;
      if (gradeLabel !== null) {
        upsertData.grade = gradeLabel;
        upsertData.descriptor = descriptor;
      }

      console.log(`Grades API: ${existingGrade ? 'Updating' : 'Creating'} grade for student ${grade.student_id} with ID ${gradeId}`);

      const { data: upsertedGrade, error: gradeError } = await withRetry(async () =>
        await supabaseAdmin
          .from('grades')
          .upsert(upsertData, { onConflict: 'id' })
          .select()
          .single()
      );

  if (gradeError) {
    console.error('Grade upsert error:', gradeError);
    throw gradeError;
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
    for (const ps of paperScores) {
      const { error: paperError } = await withRetry(async () =>
        await supabaseAdmin
          .from('grade_papers')
          .upsert({
            grade_id: upsertedGrade.id,
            paper_number: ps.number,
            score: ps.score
          })
      );
      if (paperError) {
        console.error('Paper score upsert error:', paperError);
      }
    }
  }
}

    return NextResponse.json({ message: 'Grades saved successfully' });
  } catch (error: any) {
    console.error('Error saving grades:', error);
    const errorMessage = error?.message || error?.toString() || 'Failed to save grades';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
