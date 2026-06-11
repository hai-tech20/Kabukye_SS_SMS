const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  'https://efsjtvxcjbghefckdvrm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmc2p0dnhjamJnaGVmY2tkdnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NTE2OSwiZXhwIjoyMDg3ODQxMTY5fQ.CyRoVGKFcdd3ot58XiQMxkVkjZWULFIpqeYFc2ld2w4',
  { db: { schema: 'sms' } }
);

(async () => {
  try {
    const { data: grades, error: gradesError } = await supabaseAdmin
      .from('grades')
      .select('id, student_id, subject_id, class_id, stream_id, term, academic_year, mot_score, eot_score, final_score, grade, grade_papers(paper_number, assessment_type, score)')
      .eq('term', '1')
      .eq('academic_year', '2026')
      .limit(20);
    console.log('grades error', gradesError);
    console.log('grades count', grades?.length);
    console.log(JSON.stringify(grades, null, 2));

    if (grades && grades.length > 0) {
      const studentId = grades[0].student_id;
      const { data: subjects, error: subjError } = await supabaseAdmin
        .from('student_subjects')
        .select('id, student_id, subject_id, subject_type, subjects(name, subject_type)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      console.log('student_subjects error', subjError);
      console.log(JSON.stringify(subjects, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
})();
