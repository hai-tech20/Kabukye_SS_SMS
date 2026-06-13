import { NextRequest, NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase';

function corsHeaders(origin?: string | null) {
  const allowed = ['https://kabukyesecondaryschool.com', 'https://www.kabukyesecondaryschool.com', 'http://localhost:3000', 'http://localhost:3001'];
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// GET all applications (admin only - requires auth session checked in page)
export async function GET(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    const headers = corsHeaders(origin);
    const { data: applications, error } = await supabasePublic
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch applications', details: error.message },
        { status: 500, headers }
      );
    }

    return NextResponse.json({ applications }, { headers });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// POST new application (public - from website contact form)
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    const headers = corsHeaders(origin);
    const body = await request.json();
    const {
      student_full_name,
      gender,
      date_of_birth,
      class_applying_for,
      former_school,
      district,
      subjects_and_grades,
      optional_subject,
      subject_combination,
      parent_guardian_full_name,
      parent_guardian_phone
    } = body;

    if (!student_full_name || !gender || !date_of_birth || !class_applying_for || !district || !parent_guardian_full_name || !parent_guardian_phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers }
      );
    }

    const { data, error } = await supabasePublic
      .from('applications')
      .insert([
        {
          student_full_name,
          gender,
          date_of_birth,
          class_applying_for,
          former_school: former_school || null,
          district,
          subjects_and_grades: subjects_and_grades || {},
          optional_subject: optional_subject || null,
          subject_combination: subject_combination || null,
          parent_guardian_full_name,
          parent_guardian_phone,
          created_at: new Date().toISOString()
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating application:', error);
      return NextResponse.json(
        { error: 'Failed to submit application', details: error.message },
        { status: 500, headers }
      );
    }

    return NextResponse.json({ application: data }, { status: 201, headers });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);
  return new NextResponse(null, { status: 204, headers });
}
