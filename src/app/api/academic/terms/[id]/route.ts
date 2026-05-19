import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/auth-session';

type Body = {
  start_date?: string;
  end_date?: string;
  status?: 'Active' | 'Completed' | 'Upcoming';
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.start_date !== undefined) updates.start_date = body.start_date;
  if (body.end_date !== undefined) updates.end_date = body.end_date;
  if (body.status !== undefined) updates.status = body.status;

  if (body.start_date && body.end_date && body.start_date > body.end_date) {
    return NextResponse.json({ error: 'Start date must be on or before end date' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from('terms').update(updates).eq('id', id).select().single();

  if (error) {
    console.error('term update:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: syncErr } = await supabaseAdmin.rpc('sync_term_statuses_for_current_year');
  if (syncErr) {
    console.warn('sync after term update:', syncErr.message);
  }

  return NextResponse.json({ term: data, sync_warning: syncErr?.message ?? null });
}
