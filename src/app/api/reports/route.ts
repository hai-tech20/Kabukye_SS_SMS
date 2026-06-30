import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireSession, requireAdminSession } from '@/lib/auth-session';

const weightedScore = (mot: number | null | undefined, eot: number | null | undefined): number | null => {
  if (mot === null || mot === undefined || eot === null || eot === undefined) return null;
  return (mot * 0.4) + (eot * 0.6);
};

const scoreToUnebCode = (score: number): string => {
  if (score >= 85) return 'D1';
  if (score >= 80) return 'D2';
  if (score >= 75) return 'C3';
  if (score >= 70) return 'C4';
  if (score >= 65) return 'C5';
  if (score >= 60) return 'C6';
  if (score >= 50) return 'P7';
  if (score >= 40) return 'P8';
  return 'F9';
};

const resolveAlevelSubjectGrade = (codes: string[], paperCount: number): string => {
  const num_d = codes.filter(code => code.startsWith('D')).length;
  const num_c = codes.filter(code => code.startsWith('C')).length;
  const num_p = codes.filter(code => code.startsWith('P')).length;
  const num_f = codes.filter(code => code.startsWith('F')).length;
  const hasC3 = codes.includes('C3');
  const hasC4 = codes.includes('C4');
  const hasC5 = codes.includes('C5');
  const hasC6 = codes.includes('C6');

  if (paperCount === 3) {
    if (num_d >= 2 && hasC3) return 'A';
    if (num_d >= 1 && num_c >= 2) return 'B';
    if (num_c === 3) return 'C';
    if (num_c >= 1 && num_p >= 1 && num_f === 0) return 'D';
    if (num_p >= 2 && num_f <= 1) return 'E';
    if (num_f === 2 && (num_d === 1 || num_c === 1)) return 'O';
    return 'F';
  }

  if (paperCount === 4) {
    if (num_d >= 3) return 'A';
    if (num_d >= 2 && hasC3) return 'A';
    if (num_d === 2 && num_c >= 1) return 'B';
    if (num_d === 1 && num_c >= 2 && hasC3) return 'B';
    if (num_c >= 3) return 'C';
    if (num_c === 2 && num_p === 1) return 'C';
    if (num_c === 1 && num_p === 2) return 'D';
    if (num_d === 1 && num_c === 1 && num_p === 1) return 'D';
    if (num_p >= 3) return 'E';
    if (num_p === 2 && num_f === 1 && num_d === 0 && num_c === 0) return 'E';
    if (num_f === 2 && (num_d >= 1 || num_c >= 1)) return 'O';
    return 'F';
  }

  if (num_d === 2 || (num_d === 1 && (hasC3 || hasC4))) return 'A';
  if ((num_d === 1 && (hasC5 || hasC6)) || (num_c === 2 && (hasC3 || hasC4))) return 'B';
  if (num_c === 2) return 'C';
  if (num_c === 1 && num_p === 1) return 'D';
  if (num_p === 2) return 'E';
  if (num_f === 1 && (num_d === 1 || num_c === 1)) return 'O';
  return 'F';
};

const getAlevelDescriptor = (grade: string): string => {
  switch (grade) {
    case 'A': return 'Exceptional';
    case 'B': return 'Outstanding';
    case 'C': return 'Satisfactory';
    case 'D': return 'Basic';
    case 'E': return 'Elementary';
    case 'O': return 'Ordinary';
    case 'F': return 'Fail';
    default: return 'Elementary';
  }
};

const isSubsidiarySubjectName = (subjectName: string): boolean => {
  const lower = subjectName.toLowerCase();
  return lower.includes('general paper') || lower.includes('sub ict') || lower.includes('sub mathematics') || lower.includes('sub math');
};

const getAlevelPoints = (grade: string, isSubsidiary: boolean) => {
  if (isSubsidiary) {
    const subsidiaryPoints = ['A', 'B', 'C', 'D', 'E', 'O'].includes(grade) ? 1 : 0;
    return { points: subsidiaryPoints, uacePoints: subsidiaryPoints };
  }

  switch (grade) {
    case 'A': return { points: 6, uacePoints: 6 };
    case 'B': return { points: 5, uacePoints: 5 };
    case 'C': return { points: 4, uacePoints: 4 };
    case 'D': return { points: 3, uacePoints: 3 };
    case 'E': return { points: 2, uacePoints: 2 };
    case 'O': return { points: 1, uacePoints: 1 };
    default: return { points: 0, uacePoints: 0 };
  }
};

const isAlevelSubjectName = (subjectName: string): boolean => {
  const lower = subjectName.toLowerCase();
  return lower.includes('general paper') || lower.includes('sub ict') || lower.includes('sub mathematics') || lower.includes('sub math');
};

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    const year = searchParams.get('year');
    const classId = searchParams.get('class_id');
    const streamId = searchParams.get('stream_id');

    // Fetch all data in parallel for speed
    const [
      settingsResult,
      gradingScalesResult,
      gradesResult,
      completeSettingsResult,
      publishedResult
    ] = await Promise.all([
      // Report settings for weights
      supabaseAdmin
        .from('report_settings')
        .select('mot_weight, eot_weight')
        .eq('academic_year', year || '2026')
        .eq('term', term || '1')
        .maybeSingle(),
      
      // Grading scales
      supabaseAdmin
        .from('grading_scales')
        .select('*')
        .order('min_score', { ascending: false }),
      
      // Grades with related data
      (async () => {
        let gradesQuery = supabaseAdmin
          .from('grades')
          .select(`
            id,
            student_id,
            subject_id,
            class_id,
            stream_id,
            term,
            academic_year,
            mot_score,
            eot_score,
            final_score,
            score,
            grade,
            descriptor,
            remarks,
            uace_points,
            teacher_id,
            students(full_name, schoolpay_code, class_id, stream_id),
            subjects(name, paper_count),
            teachers(full_name),
            grade_papers(paper_number, assessment_type, score)
          `)
          .order('updated_at', { ascending: false });

        if (term) gradesQuery = gradesQuery.eq('term', term);
        if (year) gradesQuery = gradesQuery.eq('academic_year', year);
        if (classId && classId !== 'ALL') gradesQuery = gradesQuery.eq('class_id', classId.toLowerCase());
        if (streamId && streamId !== 'ALL') gradesQuery = gradesQuery.eq('stream_id', streamId);
        
        return await gradesQuery;
      })(),
        
      // Complete report settings
      supabaseAdmin
        .from('report_settings')
        .select('*')
        .eq('academic_year', year || '2026')
        .eq('term', term || '1')
        .maybeSingle(),
        
      // Published reports check
      (async () => {
        let publishedQuery = supabaseAdmin
          .from('published_reports')
          .select('*')
          .eq('academic_year', year || '2026')
          .eq('term', term || '1');

        if (classId && classId !== 'ALL') publishedQuery = publishedQuery.eq('class_id', classId.toLowerCase());
        if (streamId && streamId !== 'ALL') publishedQuery = publishedQuery.eq('stream_id', streamId);
        
        return await publishedQuery;
      })()
    ]);

    const { data: settings, error: settingsError } = settingsResult;
    const effectiveSettings = settings || { mot_weight: 40, eot_weight: 60 };

    const { data: gradingScales } = gradingScalesResult;
    const { data: grades, error: gradesError } = gradesResult;
    const { data: completeSettings } = completeSettingsResult;
    const { data: publishedReports } = publishedResult;

    const isPublished = !!publishedReports && publishedReports.length > 0;

    if (gradesError) throw gradesError;

    // Deduplicate - keep only the most recent grade per student/subject/class/stream/term/year
    const gradeMap = new Map();
    for (const grade of grades || []) {
      const key = `${grade.student_id}:${grade.subject_id}:${grade.class_id}:${grade.stream_id}:${grade.term}:${grade.academic_year}`;
      if (!gradeMap.has(key)) {
        gradeMap.set(key, grade);
      }
    }
    const uniqueGrades = Array.from(gradeMap.values());
    
    // Process and enhance each grade
    const normalizedGrades = (uniqueGrades || []).map((g: any) => {
      const subjectName = g.subjects?.name || g.subject || '';
      const isALevel = Boolean(
        g.class_id?.toLowerCase()?.startsWith('s5') ||
        g.class_id?.toLowerCase()?.startsWith('s6') ||
        isAlevelSubjectName(subjectName)
      );

      let motScore = g.mot_score ?? g.mot ?? null;
      let eotScore = g.eot_score ?? g.eot ?? null;
      let finalScore = g.final_score ?? g.score ?? null;
      let gradeLabel = g.grade ?? null;
      let descriptor = g.descriptor ?? g.remarks ?? null;
      let points = g.points ?? g.uace_points ?? null;
      let uacePoints = g.uace_points ?? g.points ?? null;

      if (isALevel && g.grade_papers && Array.isArray(g.grade_papers) && g.grade_papers.length > 0) {
        const paperMap = new Map<number, { mot?: number; eot?: number }>();
        for (const paper of g.grade_papers) {
          const paperNumber = Number(paper.paper_number);
          if (!paperMap.has(paperNumber)) paperMap.set(paperNumber, {});
          const entry = paperMap.get(paperNumber)!;
          if ((paper.assessment_type || '').toString().toUpperCase() === 'MOT') {
            entry.mot = paper.score !== null && paper.score !== undefined ? Number(paper.score) : undefined;
          } else if ((paper.assessment_type || '').toString().toUpperCase() === 'EOT') {
            entry.eot = paper.score !== null && paper.score !== undefined ? Number(paper.score) : undefined;
          }
        }

        const weightedScores = Array.from(paperMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([, entry]) => weightedScore(entry.mot, entry.eot))
          .filter((value): value is number => value !== null && value !== undefined);

        if (weightedScores.length > 0) {
          finalScore = Math.round(weightedScores.reduce((sum, value) => sum + value, 0) / weightedScores.length);
          const paperCount = Math.min(g.subjects?.paper_count ?? weightedScores.length, weightedScores.length);
          const weightedCodes = weightedScores.map(s => scoreToUnebCode(Math.round(s)));
          const resolvedGrade = resolveAlevelSubjectGrade(weightedCodes, paperCount);
          gradeLabel = resolvedGrade;
          const isSubsidiary = isAlevelSubjectName(subjectName);
          const pointValues = getAlevelPoints(resolvedGrade, isSubsidiary);
          points = pointValues.points;
          uacePoints = pointValues.uacePoints;
          if (isSubsidiary) {
            gradeLabel = uacePoints ? 'O' : 'F';
            descriptor = getAlevelDescriptor(gradeLabel);
          } else {
            descriptor = getAlevelDescriptor(resolvedGrade);
          }

          const allMotScores = Array.from(paperMap.values())
            .map(entry => entry.mot)
            .filter((value): value is number => value !== undefined && value !== null);
          const allEotScores = Array.from(paperMap.values())
            .map(entry => entry.eot)
            .filter((value): value is number => value !== undefined && value !== null);

          if ((motScore === null || motScore === undefined) && allMotScores.length > 0) {
            motScore = Math.round(allMotScores.reduce((sum, value) => sum + value, 0) / allMotScores.length);
          }
          if ((eotScore === null || eotScore === undefined) && allEotScores.length > 0) {
            eotScore = Math.round(allEotScores.reduce((sum, value) => sum + value, 0) / allEotScores.length);
          }
        } else if (g.grade_papers && Array.isArray(g.grade_papers) && g.grade_papers.length > 0) {
          // Fallback: if no explicit MOT/EOT distinction, treat all papers as MOT for now
          const allScores = g.grade_papers
            .map((p: any) => p.score !== null && p.score !== undefined ? Number(p.score) : undefined)
            .filter((value: number | undefined): value is number => value !== undefined && value !== null);
          if (allScores.length > 0) {
            // Compute average as overall finalScore (used as fallback)
            finalScore = Math.round(allScores.reduce((sum: number, value: number) => sum + value, 0) / allScores.length);
            motScore = finalScore;

            // Additionally, try to derive per-paper UNEB codes and resolve A-level grade
            const paperCodes = allScores.map((s: number) => scoreToUnebCode(s));
            const paperCount = g.subjects?.paper_count ?? allScores.length;
            const resolvedGrade = resolveAlevelSubjectGrade(paperCodes, paperCount);
            gradeLabel = resolvedGrade;
            descriptor = getAlevelDescriptor(resolvedGrade);
            const isSubsidiary = isAlevelSubjectName(subjectName);
            const pointValues = getAlevelPoints(resolvedGrade, isSubsidiary);
            points = pointValues.points;
            uacePoints = pointValues.uacePoints;
          }
        }
      }

      if ((finalScore === null || finalScore === undefined) && 
          (motScore !== null && motScore !== undefined) && 
          (eotScore !== null && eotScore !== undefined)) {
        finalScore = Math.round(
          (motScore * effectiveSettings.mot_weight / 100) +
          (eotScore * effectiveSettings.eot_weight / 100)
        );
      }

      if ((!gradeLabel || !descriptor) && finalScore !== null && finalScore !== undefined && gradingScales && gradingScales.length > 0) {
        const gradeScale = gradingScales.find(
          scale => finalScore! >= scale.min_score && finalScore! <= scale.max_score
        );
        gradeLabel = gradeScale?.grade || 'E';
        descriptor = gradeScale?.descriptor || 'Elementary';
      }

      if (isALevel && (points === null || points === undefined) && gradeLabel) {
        const isSubsidiary = isAlevelSubjectName(subjectName);
        const pointValues = getAlevelPoints(gradeLabel, isSubsidiary);
        points = pointValues.points;
        uacePoints = pointValues.uacePoints;
      }

      if (isALevel && isSubsidiarySubjectName(subjectName)) {
        const subsidiaryPoints = uacePoints ?? points ?? 0;
        gradeLabel = subsidiaryPoints > 0 ? 'O' : 'F';
        descriptor = getAlevelDescriptor(gradeLabel);
        points = subsidiaryPoints;
        uacePoints = subsidiaryPoints;
      }

      return {
        ...g,
        student_id: g.student_id,
        subject_id: g.subject_id,
        subject: subjectName,
        teacher: g.teachers?.full_name || g.teacher || '',
        mot: motScore,
        eot: eotScore,
        final_score: finalScore,
        grade: gradeLabel,
        descriptor: descriptor,
        points: points,
        uace_points: uacePoints
      };
    });

    // Compute per-student totals and automatic comments (fallback)
    const totalsMap: { [studentId: string]: { total_points: number; class_teacher_comment: string; head_teacher_comment: string } } = {};
    const grouped: { [studentId: string]: any[] } = {};
    for (const g of normalizedGrades) {
      grouped[g.student_id] = grouped[g.student_id] || [];
      grouped[g.student_id].push(g);
    }

    for (const studentId of Object.keys(grouped)) {
      const list = grouped[studentId];
      const totalPoints = list.reduce((sum, x) => sum + (x.uace_points ?? x.points ?? 0), 0);
      // derive comments similarly to /api/report route
      let classTeacherComment = '';
      let headTeacherComment = '';
      const tp = totalPoints;
      if (tp >= 16) {
        classTeacherComment = 'Very good performance';
        headTeacherComment = 'Excellent performance';
      } else if (tp >= 10) {
        classTeacherComment = 'Promising results';
        headTeacherComment = 'Quite good performance';
      } else if (tp >= 6) {
        classTeacherComment = 'More effort is needed';
        headTeacherComment = 'Can do better than this';
      } else if (tp >= 1) {
        classTeacherComment = 'Improve on the weak areas';
        headTeacherComment = 'Work harder';
      } else {
        classTeacherComment = 'Needs assessment';
        headTeacherComment = 'Needs assessment';
      }

      totalsMap[studentId] = {
        total_points: totalPoints,
        class_teacher_comment: classTeacherComment,
        head_teacher_comment: headTeacherComment
      };
    }

    return NextResponse.json({ 
      data: {
        grades: normalizedGrades,
        settings: completeSettings,
        is_published: isPublished,
        totals: totalsMap
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { academic_year, term, class_id, stream_id, published_by } = await request.json();

    let studentQuery = supabaseAdmin
      .from('students')
      .select('id')
      .eq('class_id', class_id);

    if (stream_id) {
      studentQuery = studentQuery.eq('stream_id', stream_id);
    }

    const { data: studentRows, error: studentError } = await studentQuery;
    if (studentError) throw studentError;

    const studentIds = (studentRows || []).map((student: any) => student.id);

    // Delete existing published report for this term/class/stream
    let deleteQuery = supabaseAdmin
      .from('published_reports')
      .delete()
      .eq('academic_year', academic_year)
      .eq('term', term)
      .eq('class_id', class_id);

    if (stream_id) {
      deleteQuery = deleteQuery.eq('stream_id', stream_id);
    }

    await deleteQuery;

    // Insert new published report marker
    const { data, error } = await supabaseAdmin
      .from('published_reports')
      .insert({
        id: `published-${Date.now()}`,
        academic_year,
        term,
        class_id,
        stream_id,
        published_by
      })
      .select()
      .single();

    if (error) throw error;

    // Update report settings so the grade entry API can block further edits
    await supabaseAdmin
      .from('report_settings')
      .upsert({
        academic_year,
        term,
        is_published: true
      }, { onConflict: 'academic_year,term' });

    // Calculate UACE grades for S5/S6 students (if applicable)
    const { data: uaceResult, error: uaceError } = await supabaseAdmin.rpc(
      'calculate_s5_s6_uace_grades',
      {
        p_academic_year: Number(academic_year),
        p_term: Number(term)
      }
    );
    
    if (uaceError) {
      console.warn('UACE grade calculation warning:', uaceError);
      // Don't throw — UACE calculation should not block report publishing
    } else {
      console.log('UACE grades calculated successfully for year', academic_year, 'term', term);
    }

    // Mark the academic term as completed
    const { data: yearData, error: yearError } = await supabaseAdmin
      .from('academic_years')
      .select('id')
      .eq('year_label', academic_year)
      .single();

    if (!yearError && yearData?.id) {
      await supabaseAdmin
        .from('terms')
        .update({ status: 'Completed' })
        .eq('year_id', yearData.id)
        .eq('term_number', Number(term));
    }

    // Promote students after publishing final Term 3 reports
    if (term === '3') {
      const { data: promoteCheck, error: promoteCheckError } = await supabaseAdmin.rpc('can_promote');
      if (promoteCheckError) {
        throw promoteCheckError;
      }
      if (promoteCheck && typeof promoteCheck === 'object' && promoteCheck.can_promote === false) {
        return NextResponse.json(
          { error: 'Promotion is not allowed at this time', details: promoteCheck },
          { status: 400 }
        );
      }

      const { data: promotionResult, error: promotionError } = await supabaseAdmin.rpc('promote_all_students');
      if (promotionError) {
        throw promotionError;
      }
    }

    // Create published report cards for every student in the selected class/stream
    if (studentIds.length > 0) {
      await supabaseAdmin
        .from('report_cards')
        .delete()
        .in('student_id', studentIds)
        .eq('academic_year', academic_year)
        .eq('term', term);

      const reportCards = studentIds.map((studentId: string) => ({
        id: `report-${academic_year}-${term}-${studentId}`,
        student_id: studentId,
        academic_year,
        term,
        file_url: `/reports/view?student_id=${studentId}&year=${academic_year}&term=${term}`,
        status: 'published'
      }));

      const { error: reportCardError } = await supabaseAdmin
        .from('report_cards')
        .insert(reportCards);

      if (reportCardError) throw reportCardError;
    }

    return NextResponse.json({ data, message: 'Report published successfully' });
  } catch (error) {
    console.error('Error publishing report:', error);
    return NextResponse.json({ error: 'Failed to publish report' }, { status: 500 });
  }
}
