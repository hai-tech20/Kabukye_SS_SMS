const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  'https://efsjtvxcjbghefckdvrm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmc2p0dnhjamJnaGVmY2tkdnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI2NTE2OSwiZXhwIjoyMDg3ODQxMTY5fQ.CyRoVGKFcdd3ot58XiQMxkVkjZWULFIpqeYFc2ld2w4',
  { db: { schema: 'sms' } }
);

const weightedScore = (mot, eot) => {
  if (mot === null || mot === undefined || eot === null || eot === undefined) return null;
  return (mot * 0.4) + (eot * 0.6);
};

const scoreToUnebCode = (score) => {
  if (score >= 85) return 'D1';
  if (score >= 80) return 'D2';
  if (score >= 75) return 'C3';
  if (score >= 70) return 'C4';
  if (score >= 65) return 'C5';
  if (score >= 60) return 'C6';
  if (score >= 50) return 'P7';
  if (score >= 40) return 'P8';
  return 'F9';
};
const resolveAlevelSubjectGrade = (codes, paperCount) => { ... };
const getAlevelDescriptor = (grade) => { ... };
const getAlevelPoints = (grade, isSubsidiary) => { ... };
const isAlevelSubjectName = (subjectName) => { const lower = subjectName.toLowerCase(); return lower.includes('general paper') || lower.includes('sub ict') || lower.includes('sub mathematics') || lower.includes('sub math'); };

const gradingScales = [
  { min_score: 80, max_score: 100, grade: 'A', descriptor: 'Exceptional' },
  { min_score: 70, max_score: 79, grade: 'B', descriptor: 'Outstanding' },
  { min_score: 50, max_score: 69, grade: 'C', descriptor: 'Satisfactory' },
  { min_score: 35, max_score: 49, grade: 'D', descriptor: 'Basic' },
  { min_score: 0, max_score: 34, grade: 'E', descriptor: 'Elementary' }
];

(async () => {
  const { data: grades } = await supabaseAdmin
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
      grade,
      descriptor,
      points,
      uace_points,
      teacher,
      students(full_name, schoolpay_code, class_id, stream_id),
      subjects(name, paper_count),
      teachers(full_name),
      grade_papers(paper_number, assessment_type, score)
    `)
    .eq('term','1')
    .eq('academic_year','2026')
    .limit(5);
  console.log(JSON.stringify(grades,null,2));
})();
