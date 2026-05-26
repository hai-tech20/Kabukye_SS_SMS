import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    const year = searchParams.get('year');
    const classId = searchParams.get('class_id');
    const streamId = searchParams.get('stream_id');

    // Fetch grades with related data
    let gradesQuery = supabaseAdmin
      .from('grades')
      .select(`
        *,
        students(full_name, schoolpay_code, class_id, stream_id),
        subjects(name),
        teachers(full_name)
      `);

    if (term) gradesQuery = gradesQuery.eq('term', term);
    if (year) gradesQuery = gradesQuery.eq('academic_year', year);
    if (classId && classId !== 'ALL') gradesQuery = gradesQuery.eq('class_id', classId.toLowerCase());
    if (streamId && streamId !== 'ALL') gradesQuery = gradesQuery.eq('stream_id', streamId);

    const { data: grades, error: gradesError } = await gradesQuery;

    if (gradesError) throw gradesError;

    const normalizedGrades = (grades || []).map((g: any) => ({
      ...g,
      subject: g.subjects?.name || g.subject || '',
      teacher: g.teachers?.full_name || g.teacher || '',
      mot: g.mot_score ?? g.mot ?? 0,
      eot: g.eot_score ?? g.eot ?? 0,
      final_score: g.final_score ?? 0,
      grade: g.grade || '',
      descriptor: g.descriptor || ''
    }));

    // Fetch report settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('report_settings')
      .select('*')
      .eq('academic_year', year || '2026')
      .eq('term', term || '1')
      .single();

    // Check if results are published
    let publishedQuery = supabaseAdmin
      .from('published_reports')
      .select('*')
      .eq('academic_year', year || '2026')
      .eq('term', term || '1');

    if (classId && classId !== 'ALL') publishedQuery = publishedQuery.eq('class_id', classId.toLowerCase());
    if (streamId && streamId !== 'ALL') publishedQuery = publishedQuery.eq('stream_id', streamId);

    const { data: publishedReports, error: publishedError } = await publishedQuery;

    const isPublished = !publishedError && publishedReports && publishedReports.length > 0;

    return NextResponse.json({ 
      data: {
        grades: normalizedGrades,
        settings: settings,
        is_published: isPublished
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
