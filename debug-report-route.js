const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  'https://efsjtvxcjbghefckdvrm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmc2p0dnhjamJnaGVmI2tkdnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NTE2OSwiZXhwIjoyMDg3ODQxMTY5fQ.CyRoVGKFcdd3ot58XiQMxkVkjZWULFIpqeYFc2ld2w4',
  { db: { schema: 'sms' } }
);

(async () => {
  const { data, error } = await supabaseAdmin
    .from('grades')
    .select(`
      id,
      student_id,
      subject_id,
      class_id,
      stream_id,
      term,
      academic_year,
      mot_score,
      eot_score,
      final_score,
      score,
      grade,
      descriptor,
      remarks,
      uace_points,
      teacher_id,
      students(full_name, schoolpay_code, class_id, stream_id),
      subjects(name, paper_count),
      teachers(full_name),
      grade_papers(paper_number, assessment_type, score)
    `)
    .eq('term', '1')
    .eq('academic_year', '2026')
    .eq('class_id', 's5')
    .eq('stream_id', 's5-sciences')
    .limit(5);
  console.log('error', error);
  console.log('data', JSON.stringify(data, null, 2));
})();