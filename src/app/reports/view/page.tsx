'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ReportCard,
  getClassLevel,
  normalizeReportGrades,
  type Student,
  type Grade,
  type AcademicTerm,
} from '@/components/reports/report-card';

function ReportViewContent() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id');
  const term = searchParams.get('term');
  const year = searchParams.get('year');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classTeacher, setClassTeacher] = useState('Not Assigned');
  const [classTeacherComment, setClassTeacherComment] = useState('');
  const [headTeacherComment, setHeadTeacherComment] = useState('');
  const [academicTerm, setAcademicTerm] = useState<AcademicTerm | undefined>();
  const [optionalSubjects, setOptionalSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<Array<{ id: string; subject_id?: string; name: string; subject_type: string }>>([]);
  const [positionInClass, setPositionInClass] = useState<number | undefined>();
  const [positionInStream, setPositionInStream] = useState<number | undefined>();
  const [totalStudentsInClass, setTotalStudentsInClass] = useState<number | undefined>();
  const [totalStudentsInStream, setTotalStudentsInStream] = useState<number | undefined>();

  useEffect(() => {
    if (!studentId || !term || !year) {
      setError('Missing report parameters.');
      setLoading(false);
      return;
    }

    const loadReport = async () => {
      try {
        const sessionRes = await fetch('/api/auth/me');
        if (!sessionRes.ok) {
          window.location.href = `/login/student?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }

        const reportRes = await fetch(`/api/report?student_id=${studentId}&term=${term}&year=${year}`);
        if (!reportRes.ok) {
          const body = await reportRes.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load report');
        }

        const reportData = await reportRes.json();
        const rawStudent = reportData.data?.student;
        if (!rawStudent) {
          throw new Error('Student not found');
        }

        const mappedStudent: Student = {
          id: rawStudent.id,
          full_name: rawStudent.full_name,
          class: rawStudent.classes?.name || rawStudent.class_id?.toUpperCase() || 'Unknown',
          stream: rawStudent.streams?.name || rawStudent.stream_id || 'Unknown',
          gender: rawStudent.gender,
          photo_url: rawStudent.photo_url,
          subject_combination: rawStudent.subject_combination,
          schoolpay_code: rawStudent.schoolpay_code,
          total_uace_points: rawStudent.total_uace_points,
        };
        setStudent(mappedStudent);

        const normalizedGrades = normalizeReportGrades(reportData.data?.grades || []);
        setGrades(normalizedGrades);

        const comments = reportData.data?.comments || {};
        setClassTeacherComment(
          comments.class_teacher_comment ||
            comments.class_teacher_comment_text ||
            comments.class_teacher ||
            ''
        );
        setHeadTeacherComment(
          comments.head_teacher_comment ||
            comments.head_teacher_comment_text ||
            comments.head_teacher ||
            ''
        );

        const classLevel = getClassLevel(mappedStudent.class);
        if (classLevel === 'S1-S2' || classLevel === 'S3-S4') {
          const optRes = await fetch(`/api/student-optional-subjects?student_id=${studentId}`);
          if (optRes.ok) {
            const optData = await optRes.json();
            setOptionalSubjects(
              (optData.data || []).map((item: { id: string; subjects?: { name: string } }) => ({
                id: item.id,
                name: item.subjects?.name || '',
              }))
            );
          }
        } else {
          const assignRes = await fetch(`/api/student-subjects?student_id=${studentId}`);
          if (assignRes.ok) {
            const assignData = await assignRes.json();
            setAssignedSubjects(
              (assignData.data || []).map((item: { id: string; subject_id?: string; subject_type?: string; subjects?: { name: string; subject_type?: string } }) => ({
                id: item.id,
                subject_id: item.subject_id,
                name: item.subjects?.name || '',
                subject_type: item.subject_type || item.subjects?.subject_type || '',
              }))
            );
          }
        }

        const teacherRes = await fetch(`/api/students/${studentId}/class-teacher`);
        if (teacherRes.ok) {
          const teacherData = await teacherRes.json();
          setClassTeacher(teacherData.data || 'Not Assigned');
        }

        const overviewRes = await fetch('/api/academic/overview');
        if (overviewRes.ok) {
          const overview = await overviewRes.json();
          const yearItem = (overview.academic_years || []).find((y: { year_label: string }) => y.year_label === year);
          const currentTermNumber = Number(term);
          if (yearItem) {
            const currentTerm = (overview.terms || []).find(
              (t: { term_number: number; year_id: string }) =>
                Number(t.term_number) === currentTermNumber && t.year_id === yearItem.id
            );
            const nextTerm =
              (overview.terms || []).find(
                (t: { term_number: number; year_id: string }) =>
                  Number(t.term_number) === currentTermNumber + 1 && t.year_id === yearItem.id
              ) ||
              (currentTermNumber === 3
                ? (overview.terms || []).find((t: { term_number: number; year_id: string }) => {
                    const termYear = overview.academic_years?.find((y: { id: string; year_label: string }) => y.id === t.year_id);
                    return Number(t.term_number) === 1 && termYear?.year_label === String(Number(year) + 1);
                  })
                : null);

            if (currentTerm) {
              setAcademicTerm({
                end_date: currentTerm.end_date,
                next_term_start_date: nextTerm?.start_date || '',
              });
            }
          }
        }

        const classId = rawStudent.class_id?.toLowerCase();
        const streamId = rawStudent.stream_id;
        if (classId) {
          const reportsParams = new URLSearchParams({ term, year, class_id: classId });
          if (streamId) reportsParams.append('stream_id', streamId);
          const reportsRes = await fetch(`/api/reports?${reportsParams.toString()}`);
          if (reportsRes.ok) {
            const reportsData = await reportsRes.json();
            const allGrades = normalizeReportGrades(reportsData.data?.grades || []);
            const classStudents = new Map<string, { avg: number; points: number }>();
            const streamStudents = new Map<string, { avg: number; points: number }>();
            const usePoints = classLevel === 'S5-S6';

            const studentIdsInClass = new Set<string>();
            const studentIdsInStream = new Set<string>();

            allGrades.forEach((g) => {
              if (g.student_id === studentId) return;
              studentIdsInClass.add(g.student_id);
              studentIdsInStream.add(g.student_id);
            });
            studentIdsInClass.add(studentId);
            studentIdsInStream.add(studentId);

            const byStudent: Record<string, Grade[]> = {};
            allGrades.forEach((g) => {
              byStudent[g.student_id] = byStudent[g.student_id] || [];
              byStudent[g.student_id].push(g);
            });

            Object.entries(byStudent).forEach(([id, list]) => {
              const totalScore = list.reduce((sum, x) => sum + (x.final_score || 0), 0);
              const avg = list.length > 0 ? Math.round(totalScore / list.length) : 0;
              const totalPoints = list.reduce((sum, x) => sum + (x.uace_points ?? x.points ?? 0), 0);
              classStudents.set(id, { avg, points: totalPoints });
              streamStudents.set(id, { avg, points: totalPoints });
            });

            const rank = (ids: string[], id: string) => {
              const sorted = [...ids].sort((a, b) => {
                const ma = classStudents.get(a) || { avg: 0, points: 0 };
                const mb = classStudents.get(b) || { avg: 0, points: 0 };
                const va = usePoints ? ma.points : ma.avg;
                const vb = usePoints ? mb.points : mb.avg;
                return vb - va;
              });
              return sorted.indexOf(id) + 1;
            };

            const classIds = [...classStudents.keys()];
            const streamIds = [...streamStudents.keys()];
            setPositionInClass(rank(classIds, studentId));
            setPositionInStream(rank(streamIds, studentId));
            setTotalStudentsInClass(classIds.length);
            setTotalStudentsInStream(streamIds.length);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [studentId, term, year]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Report Unavailable</h1>
          <p className="text-gray-700 mb-4">{error || 'Could not load this report card.'}</p>
          <a href="/dashboard/student" className="text-blue-700 font-semibold hover:underline">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto px-4 no-print mb-4 flex justify-between items-center">
        <a href="/dashboard/student" className="text-blue-800 font-semibold hover:underline">
          ← Back to Dashboard
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-blue-900 text-white px-4 py-2 rounded-lg hover:bg-blue-800"
        >
          Print / Save as PDF
        </button>
      </div>
      <ReportCard
        student={student}
        grades={grades}
        term={term!}
        year={year!}
        classTeacher={classTeacher}
        headTeacher="Mr. ISABIRYE SALEH"
        classTeacherComment={classTeacherComment}
        headTeacherComment={headTeacherComment}
        academicTerm={academicTerm}
        optionalSubjects={optionalSubjects}
        assignedSubjects={assignedSubjects}
        positionInClass={positionInClass}
        positionInStream={positionInStream}
        totalStudentsInClass={totalStudentsInClass}
        totalStudentsInStream={totalStudentsInStream}
      />
    </div>
  );
}

export default function ReportViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900" />
        </div>
      }
    >
      <ReportViewContent />
    </Suspense>
  );
}
