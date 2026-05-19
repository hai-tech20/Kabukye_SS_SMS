import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection by fetching from classes table
    const { data: classes, error: classesError } = await supabaseAdmin
      .from('classes')
      .select('id, name')
      .limit(5);
    
    if (classesError) {
      console.error('Classes table error:', classesError);
      return NextResponse.json({ 
        success: false, 
        error: 'Classes table error', 
        details: classesError 
      }, { status: 500 });
    }
    
    // Test students table
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, full_name, class_id')
      .limit(5);
    
    if (studentsError) {
      console.error('Students table error:', studentsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Students table error', 
        details: studentsError 
      }, { status: 500 });
    }
    
    // Test teachers table
    const { data: teachers, error: teachersError } = await supabaseAdmin
      .from('teachers')
      .select('id, full_name, email')
      .limit(5);
    
    if (teachersError) {
      console.error('Teachers table error:', teachersError);
      return NextResponse.json({ 
        success: false, 
        error: 'Teachers table error', 
        details: teachersError 
      }, { status: 500 });
    }
    
    // Test subjects table
    const { data: subjects, error: subjectsError } = await supabaseAdmin
      .from('subjects')
      .select('id, name')
      .limit(5);
    
    if (subjectsError) {
      console.error('Subjects table error:', subjectsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Subjects table error', 
        details: subjectsError 
      }, { status: 500 });
    }
    
    console.log('Database connection successful!');
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful!',
      data: {
        classes: classes || [],
        students: students || [],
        teachers: teachers || [],
        subjects: subjects || []
      },
      counts: {
        classes: classes?.length || 0,
        students: students?.length || 0,
        teachers: teachers?.length || 0,
        subjects: subjects?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Database test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Database connection test failed', 
      details: error 
    }, { status: 500 });
  }
}
