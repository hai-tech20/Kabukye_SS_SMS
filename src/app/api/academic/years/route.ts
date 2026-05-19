import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/auth-session';

/** Create a new academic year and three placeholder terms (admin edits dates in the UI). */
export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  let body: { year_label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const raw = body.year_label?.trim() ?? '';
  if (!/^\d{4}$/.test(raw)) {
    return NextResponse.json({ error: 'year_label must be a 4-digit year (e.g. 2027)' }, { status: 400 });
  }

  const { data: dup } = await supabaseAdmin.from('academic_years').select('id').eq('year_label', raw).maybeSingle();
  if (dup) {
    return NextResponse.json({ error: `Academic year ${raw} already exists` }, { status: 409 });
  }

  const y = parseInt(raw, 10);
  const { data: yearRow, error: yErr } = await supabaseAdmin
    .from('academic_years')
    .insert({ year_label: raw, is_current: false })
    .select()
    .single();

  if (yErr || !yearRow) {
    console.error('insert academic_years:', yErr);
    return NextResponse.json({ error: yErr?.message || 'Could not create academic year' }, { status: 400 });
  }

  const placeholderTerms = [
    { year_id: yearRow.id, term_number: 1, start_date: `${y}-01-15`, end_date: `${y}-04-30`, status: 'Upcoming' as const },
    { year_id: yearRow.id, term_number: 2, start_date: `${y}-05-10`, end_date: `${y}-08-20`, status: 'Upcoming' as const },
    { year_id: yearRow.id, term_number: 3, start_date: `${y}-09-05`, end_date: `${y}-12-15`, status: 'Upcoming' as const },
  ];

  const { error: tErr } = await supabaseAdmin.from('terms').insert(placeholderTerms);
  if (tErr) {
    await supabaseAdmin.from('academic_years').delete().eq('id', yearRow.id);
    console.error('insert terms:', tErr);
    return NextResponse.json({ error: tErr.message }, { status: 400 });
  }

  return NextResponse.json({ academic_year: yearRow, message: `Year ${raw} created. Adjust term dates in the table.` });
}
