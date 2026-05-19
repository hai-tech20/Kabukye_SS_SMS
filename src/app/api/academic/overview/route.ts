import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/auth-session';

export async function GET() {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const [{ data: years, error: yErr }, { data: terms, error: tErr }] = await Promise.all([
      supabaseAdmin.from('academic_years').select('*').order('year_label', { ascending: true }),
      supabaseAdmin.from('terms').select('*').order('year_id').order('term_number'),
    ]);

    if (yErr) throw yErr;
    if (tErr) throw tErr;

    const { data: canData, error: canErr } = await supabaseAdmin.rpc('can_promote');
    if (canErr) {
      console.warn('can_promote RPC:', canErr.message);
    }

    const { data: syncData, error: syncErr } = await supabaseAdmin.rpc('sync_term_statuses_for_current_year');
    if (syncErr) {
      console.warn('sync_term_statuses RPC:', syncErr.message);
    }

    const { data: classes } = await supabaseAdmin
      .from('classes')
      .select('id, name, next_class_id')
      .order('name');

    return NextResponse.json({
      academic_years: years ?? [],
      terms: terms ?? [],
      can_promote: canData ?? { can_promote: false, reason: 'RPC unavailable — run migrations/2026_academic_promotion_complete.sql' },
      sync: syncData ?? null,
      sync_error: syncErr?.message ?? null,
      classes: classes ?? [],
    });
  } catch (e) {
    console.error('academic overview:', e);
    return NextResponse.json({ error: 'Failed to load academic data' }, { status: 500 });
  }
}
