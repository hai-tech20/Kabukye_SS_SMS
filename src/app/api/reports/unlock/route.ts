import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/auth-session';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { academic_year, term, class_id, stream_id } = await request.json();

    if (!academic_year || !term) {
      return NextResponse.json({ error: 'Missing required fields: academic_year and term' }, { status: 400 });
    }

    // Delete the published report marker
    let deleteQuery = supabaseAdmin
      .from('published_reports')
      .delete()
      .eq('academic_year', academic_year)
      .eq('term', term);

    if (class_id) {
      deleteQuery = deleteQuery.eq('class_id', class_id.toLowerCase());
    }
    if (stream_id) {
      deleteQuery = deleteQuery.eq('stream_id', stream_id);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw deleteError;

    // Also update report_settings to set is_published to false
    await supabaseAdmin
      .from('report_settings')
      .upsert({
        academic_year,
        term,
        is_published: false
      }, { onConflict: 'academic_year,term' });

    // Update terms status back to Active (if term was marked as completed)
    const { data: yearData } = await supabaseAdmin
      .from('academic_years')
      .select('id')
      .eq('year_label', academic_year)
      .single();

    if (yearData?.id) {
      await supabaseAdmin
        .from('terms')
        .update({ status: 'Active' })
        .eq('year_id', yearData.id)
        .eq('term_number', Number(term));
    }

    // Delete report cards for this term/class/stream (they'll be regenerated on re-publish)
    let reportCardQuery = supabaseAdmin
      .from('report_cards')
      .delete()
      .eq('academic_year', academic_year)
      .eq('term', term);

    if (class_id) {
      reportCardQuery = reportCardQuery.eq('class_id', class_id.toLowerCase());
    }
    if (stream_id) {
      reportCardQuery = reportCardQuery.eq('stream_id', stream_id);
    }

    await reportCardQuery;

    return NextResponse.json({ 
      message: 'Reports unlocked successfully. You can now edit grades for this term.',
      unlocked: { academic_year, term, class_id, stream_id }
    });
  } catch (error: any) {
    console.error('Error unlocking reports:', error);
    return NextResponse.json({ error: 'Failed to unlock reports' }, { status: 500 });
  }
}