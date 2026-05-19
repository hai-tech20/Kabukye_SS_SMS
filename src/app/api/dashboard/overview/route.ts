import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('Starting dashboard overview - fetching actual records...');

    // Fetch all records and count them directly
    const studentsResult = await supabaseAdmin.from('students').select('*');
    const teachersResult = await supabaseAdmin.from('teachers').select('*');
    const classesResult = await supabaseAdmin.from('classes').select('*');
    const streamsResult = await supabaseAdmin.from('streams').select('*');
    const subjectsResult = await supabaseAdmin.from('subjects').select('*');

    // Count the actual records
    const studentsCount = studentsResult.data ? studentsResult.data.length : 0;
    const teachersCount = teachersResult.data ? teachersResult.data.length : 0;
    const classesCount = classesResult.data ? classesResult.data.length : 0;
    const streamsCount = streamsResult.data ? streamsResult.data.length : 0;
    const subjectsCount = subjectsResult.data ? subjectsResult.data.length : 0;

    console.log('Record counts:', {
      students: studentsCount,
      teachers: teachersCount,
      classes: classesCount,
      streams: streamsCount,
      subjects: subjectsCount
    });

    // Log errors if any
    if (studentsResult.error) console.error('Students fetch error:', studentsResult.error);
    if (teachersResult.error) console.error('Teachers fetch error:', teachersResult.error);

    // Get recent activity
    const recentStudents = studentsResult.data 
      ? studentsResult.data.slice(0, 5).map((s: any) => ({ 
          full_name: s.full_name, 
          class_id: s.class_id, 
          created_at: s.created_at 
        }))
      : [];

    const recentTeachers = teachersResult.data
      ? teachersResult.data.slice(0, 5).map((t: any) => ({
          full_name: t.full_name,
          created_at: t.created_at
        }))
      : [];

    // Get class distribution from the student data we already have
    const classDistribution: Record<string, number> = {};
    if (studentsResult.data) {
      studentsResult.data.forEach((student: any) => {
        const classId = student.class_id;
        classDistribution[classId] = (classDistribution[classId] || 0) + 1;
      });
    }

    const counts = {
      students: studentsCount,
      teachers: teachersCount,
      classes: classesCount,
      streams: streamsCount,
      subjects: subjectsCount
    };

    console.log('Final dashboard counts:', counts);

    // Return response with cache-busting headers
    const response = NextResponse.json({
      success: true,
      data: {
        counts: counts,
        recentActivity: {
          recentStudents: recentStudents,
          recentTeachers: recentTeachers
        },
        classDistribution: classDistribution
      }
    });

    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error) {
    console.error('Dashboard overview error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch dashboard data', 
      details: error 
    }, { status: 500 });
  }
}
