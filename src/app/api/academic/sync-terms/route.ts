import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/auth-session';

export async function POST() {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseAdmin.rpc('sync_term_statuses_for_current_year');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ result: data });
}
