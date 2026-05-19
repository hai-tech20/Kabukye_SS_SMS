import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
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
        grades: grades || [],
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
  try {
    const { academic_year, term, class_id, stream_id, published_by } = await request.json();

    // Delete existing published report for this term/class/stream
    await supabaseAdmin
      .from('published_reports')
      .delete()
      .eq('academic_year', academic_year)
      .eq('term', term)
      .eq('class_id', class_id)
      .eq('stream_id', stream_id);

    // Insert new published report
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

    return NextResponse.json({ data, message: 'Report published successfully' });
  } catch (error) {
    console.error('Error publishing report:', error);
    return NextResponse.json({ error: 'Failed to publish report' }, { status: 500 });
  }
}
