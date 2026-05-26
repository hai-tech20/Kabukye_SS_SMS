import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminSession } from '@/lib/auth-session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (auth instanceof NextResponse) return auth;

    console.log('Checking for duplicate grades...');
    
    // Find all duplicate grades (same student/subject/class/stream/term/year)
    const { data: duplicates, error } = await supabaseAdmin
      .from('grades')
      .select('student_id, subject_id, class_id, stream_id, term, academic_year, id, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error finding duplicates:', error);
      return NextResponse.json({ error: 'Failed to find duplicates' }, { status: 500 });
    }
    
    // Group by unique key and find duplicates
    const gradeMap = new Map();
    const duplicatesToDelete = [];
    
    for (const grade of duplicates || []) {
      const key = `${grade.student_id}:${grade.subject_id}:${grade.class_id}:${grade.stream_id}:${grade.term}:${grade.academic_year}`;
      
      if (gradeMap.has(key)) {
        // This is a duplicate - mark for deletion (keep the first one which is most recent due to ordering)
        duplicatesToDelete.push(grade.id);
      } else {
        gradeMap.set(key, grade.id);
      }
    }
    
    console.log(`Found ${duplicatesToDelete.length} duplicate grades to delete`);
    
    // Delete duplicates
    let deletedCount = 0;
    for (const id of duplicatesToDelete) {
      const { error: deleteError } = await supabaseAdmin
        .from('grades')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        console.error(`Error deleting grade ${id}:`, deleteError);
      } else {
        deletedCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Deleted ${deletedCount} duplicate grades`,
      totalDuplicates: duplicatesToDelete.length
    });
    
  } catch (error) {
    console.error('Error fixing duplicates:', error);
    return NextResponse.json({ 
      error: 'Failed to fix duplicates',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
