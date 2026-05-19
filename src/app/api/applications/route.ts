import { NextRequest, NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase';

// GET all applications
export async function GET() {
  try {
    const { data: applications, error } = await supabasePublic
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch applications', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ applications });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
