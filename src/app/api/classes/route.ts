import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, withRetry } from '@/lib/supabase';
import { getCurrentTerm } from '@/lib/academic-calendar';
import { requireStaff, requireAdminSession } from '@/lib/auth-session';

// Simple in-memory cache for reference data (classes/streams/subjects change rarely)
const CACHE_TTL = 30000; // 30 seconds
let cache: { data: any; timestamp: number } | null = null;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    if (auth instanceof NextResponse) return auth;

    const now = Date.now();
    
    // Return cached data if fresh
    if (cache && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
        }
      });
    }
    
    const currentAcademicInfo = getCurrentTerm();
    
    // Fetch only necessary columns - avoid select('*') for smaller payload
    const [classesResult, streamsResult, subjectsResult] = await Promise.all([
      withRetry(() => supabaseAdmin.from('classes').select('id, name, next_class_id, academic_year').order('name', { ascending: true })),
      withRetry(() => supabaseAdmin.from('streams').select('id, name, class_id').order('name', { ascending: true })),
      withRetry(() => supabaseAdmin.from('subjects').select('id, name, class_id').order('name', { ascending: true }))
    ]);

    if (classesResult.error) throw classesResult.error;
    if (streamsResult.error) throw streamsResult.error;
    if (subjectsResult.error) throw subjectsResult.error;

    const classes = classesResult.data || [];
    const streams = streamsResult.data || [];
    const subjects = subjectsResult.data || [];

    // Optimized: Use a single query with count grouping instead of multiple queries in a loop
    const { data: studentCountsData, error: countError } = await withRetry(async () =>
      await supabaseAdmin
        .from('students')
        .select('class_id, stream_id')
        .eq('status', 'active')
    );

    if (countError) throw countError;

    // Manual count grouping to avoid multiple round-trips
    const classCountsMap: Record<string, number> = {};
    const streamCountsMap: Record<string, number> = {};

    studentCountsData?.forEach(student => {
      if (student.class_id) {
        classCountsMap[student.class_id] = (classCountsMap[student.class_id] || 0) + 1;
      }
      if (student.stream_id) {
        streamCountsMap[student.stream_id] = (streamCountsMap[student.stream_id] || 0) + 1;
      }
    });

    // Combine data with counts
    const classesWithCounts = classes.map(cls => ({
      ...cls,
      academic_year: currentAcademicInfo.academicYear.toString(),
      term: currentAcademicInfo.name,
      student_count: classCountsMap[cls.id] || 0
    }));

    const streamsWithCounts = streams.map(stream => ({
      ...stream,
      student_count: streamCountsMap[stream.id] || 0
    }));

    const responseData = {
      data: {
        classes: classesWithCounts,
        streams: streamsWithCounts,
        subjects: subjects,
        currentAcademicYear: currentAcademicInfo.academicYear,
        currentTerm: currentAcademicInfo.name,
        termDays: currentAcademicInfo.days
      }
    };
    
    // Update cache
    cache = { data: responseData, timestamp: Date.now() };
    
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    
    const { data, error } = await supabaseAdmin
      .from('classes')
      .insert({
        name: body.name,
        academic_year: getCurrentTerm().academicYear.toString(),
        term: getCurrentTerm().name
      })
      .select()
      .single();

    if (error) throw error;
    
    // Clear cache to ensure fresh data on next fetch
    cache = null;

    return NextResponse.json({ data, message: 'Class added successfully' });
  } catch (error) {
    console.error('Error adding class:', error);
    return NextResponse.json({ error: 'Failed to add class' }, { status: 500 });
  }
}
