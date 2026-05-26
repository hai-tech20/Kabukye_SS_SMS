import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminSession } from '@/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }
    const auth = await requireAdminSession();
    if (auth instanceof NextResponse) return auth;
    // Insert classes
    const classes = [
      { name: 'S1', academic_year: '2025', term: 'Term 1' },
      { name: 'S2', academic_year: '2025', term: 'Term 1' },
      { name: 'S3', academic_year: '2025', term: 'Term 1' },
      { name: 'S4', academic_year: '2025', term: 'Term 1' },
      { name: 'S5', academic_year: '2025', term: 'Term 1' },
      { name: 'S6', academic_year: '2025', term: 'Term 1' }
    ];

    const { data: insertedClasses, error: classesError } = await supabaseAdmin
      .from('sms.classes')
      .upsert(classes, { onConflict: 'name' })
      .select();

    if (classesError) throw classesError;

    // Insert streams with proper logic
    const streams = [];
    
    // For S1-S4: B and C streams
    for (let i = 1; i <= 4; i++) {
      const className = `S${i}`;
      const classData = insertedClasses?.find((c: any) => c.name === className);
      if (classData) {
        streams.push(
          { class_id: classData.id, name: 'B' },
          { class_id: classData.id, name: 'C' }
        );
      }
    }
    
    // For S5-S6: Arts and Sciences streams
    for (let i = 5; i <= 6; i++) {
      const className = `S${i}`;
      const classData = insertedClasses?.find((c: any) => c.name === className);
      if (classData) {
        streams.push(
          { class_id: classData.id, name: 'Arts' },
          { class_id: classData.id, name: 'Sciences' }
        );
      }
    }

    const { data: insertedStreams, error: streamsError } = await supabaseAdmin
      .from('sms.streams')
      .upsert(streams, { onConflict: 'class_id,name' })
      .select();

    if (streamsError) throw streamsError;

    // Insert basic subjects for each class
    const subjects = [];
    const basicSubjects = ['Mathematics', 'English', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Literature', 'Economics'];
    
    for (const classData of insertedClasses || []) {
      for (const subjectName of basicSubjects) {
        subjects.push({
          class_id: classData.id,
          name: subjectName,
          is_compulsory: true
        });
      }
    }

    const { data: insertedSubjects, error: subjectsError } = await supabaseAdmin
      .from('sms.subjects')
      .upsert(subjects, { onConflict: 'class_id,name' })
      .select();

    if (subjectsError) throw subjectsError;

    // Insert grading scales
    const gradingScales = [
      { grade: 'A', min_score: 80, max_score: 100, descriptor: 'Exceptional' },
      { grade: 'B', min_score: 70, max_score: 79, descriptor: 'Outstanding' },
      { grade: 'C', min_score: 50, max_score: 69, descriptor: 'Satisfactory' },
      { grade: 'D', min_score: 35, max_score: 49, descriptor: 'Basic' },
      { grade: 'E', min_score: 0, max_score: 34, descriptor: 'Elementary' }
    ];

    const { error: gradingError } = await supabaseAdmin
      .from('sms.grading_scales')
      .upsert(gradingScales, { onConflict: 'grade' });

    if (gradingError) throw gradingError;

    // Insert report settings
    const reportSettings = {
      term: 'Term 1',
      academic_year: '2025',
      assessment_count: 3,
      bot_weight: 30,
      mot_weight: 30,
      eot_weight: 40,
      next_term_begins: '2025-05-05',
      date_of_issue: '2025-04-15',
      is_published: true
    };

    const { error: reportError } = await supabaseAdmin
      .from('sms.report_settings')
      .upsert(reportSettings, { onConflict: 'term,academic_year' });

    if (reportError) throw reportError;

    return NextResponse.json({ 
      message: 'Database seeded successfully',
      classes: insertedClasses?.length,
      streams: insertedStreams?.length,
      subjects: insertedSubjects?.length
    });

  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
