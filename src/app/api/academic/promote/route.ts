import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/auth-session';

export async function POST() {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  const { data: pre, error: preErr } = await supabaseAdmin.rpc('can_promote');
  if (preErr) {
    return NextResponse.json({ error: preErr.message }, { status: 400 });
  }
  if (pre && typeof pre === 'object' && 'can_promote' in pre && pre.can_promote === false) {
    return NextResponse.json(
      { error: (pre as { reason?: string }).reason || 'Promotion not allowed', details: pre },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.rpc('promote_all_students');

  if (error) {
    console.error('promote_all_students:', error);
    return NextResponse.json(
      { error: error.message || 'Promotion failed', hint: 'Ensure migrations are applied and the next academic year row exists.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ result: data });
}
