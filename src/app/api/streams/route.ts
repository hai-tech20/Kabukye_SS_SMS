import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(request.url);
    const class_id = searchParams.get('class_id');
    
    if (!class_id) {
      return NextResponse.json({ error: 'class_id required' }, { status: 400 });
    }
    
    // Return real streams from database
    const { data: streams, error } = await supabaseAdmin
      .from('streams')
      .select('*')
      .eq('class_id', class_id);
    
    if (error) throw error;
    
    return NextResponse.json(streams || []);
  } catch (error) {
    console.error('Streams API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
