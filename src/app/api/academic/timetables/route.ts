import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/auth-session';
import { randomUUID } from 'crypto';

const BUCKET = 'timetables';

export async function GET() {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  const { data: rows, error } = await supabaseAdmin.from('timetables').select('*').order('uploaded_at', { ascending: false });

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      return NextResponse.json({ timetables: [], warning: 'timetables table missing — run academic migrations' });
    }
    console.error('timetables list:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ timetables: rows ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (auth instanceof NextResponse) return auth;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const file = form.get('file');
  const classId = form.get('class_id');
  const academicYear = form.get('academic_year');

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (typeof classId !== 'string' || !classId) {
    return NextResponse.json({ error: 'class_id is required' }, { status: 400 });
  }
  if (typeof academicYear !== 'string' || !academicYear) {
    return NextResponse.json({ error: 'academic_year is required (e.g. 2026)' }, { status: 400 });
  }

  const streamId = form.get('stream_id');
  const stream = typeof streamId === 'string' && streamId.length > 0 ? streamId : null;

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${academicYear}/${classId}/${Date.now()}_${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (upErr) {
    console.error('storage upload:', upErr);
    return NextResponse.json(
      {
        error: upErr.message,
        hint: `Create a public or signed-read bucket named "${BUCKET}" in Supabase Storage.`,
      },
      { status: 400 }
    );
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const fileUrl = pub.publicUrl;

  const row = {
    id: randomUUID(),
    academic_year: academicYear,
    class_id: classId,
    stream_id: stream,
    file_name: file.name,
    file_url: fileUrl,
    uploaded_by: auth.id,
  };

  const { data: inserted, error: insErr } = await supabaseAdmin.from('timetables').insert(row).select().single();

  if (insErr) {
    console.error('timetables insert:', insErr);
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ timetable: inserted });
}
