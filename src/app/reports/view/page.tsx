'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ReportCard,
  getClassLevel,
  normalizeReportGrades,
  type Student,
  type Grade,
  type AcademicTerm,
} from '@/components/reports/report-card';
import {
  captureReportCardImage,
  blobToDataUrl,
  createEmptyPdfDoc,
  addImagePage,
} from '@/lib/report-card-pdf-capture';
import { downloadBlob, sanitizeFileName } from '@/lib/zip-utils';
import { getTermLabel } from '@/lib/report-card-pdf-job';

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

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const pdfContainerRef = useRef<HTMLDivElement>(null);

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

  // Once all report data is loaded, capture the report card the same way the
  // admin's bulk ZIP does, so the student sees the identical high-res PDF.
  useEffect(() => {
    if (loading || !student || pdfUrl || generatingPdf) return;

    let cancelled = false;

    const generatePdf = async () => {
      setGeneratingPdf(true);
      setPdfError('');
      try {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const element = pdfContainerRef.current?.querySelector('.pdf-report-card') as HTMLElement | null;
        if (!element) throw new Error('Report card element not ready');

        const captured = await captureReportCardImage(element);
        const dataUrl = await blobToDataUrl(captured.imageBlob);
        const pdf = createEmptyPdfDoc();
        addImagePage(pdf, dataUrl, captured.pixelWidth, captured.pixelHeight, true);
        const blob = pdf.output('blob');

        if (cancelled) return;
        setPdfBlob(blob);
        setPdfUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error('Failed to generate report card PDF:', err);
        if (!cancelled) setPdfError('Could not generate a PDF preview. Showing the report details below instead.');
      } finally {
        if (!cancelled) setGeneratingPdf(false);
      }
    };

    void generatePdf();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, student]);

  // Revoke the generated blob URL when the page unmounts or a new PDF replaces it.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const handleDownload = () => {
    if (!pdfBlob || !student) return;
    const termLabel = getTermLabel(term || '1');
    downloadBlob(pdfBlob, `${sanitizeFileName(student.full_name)} - ${termLabel} ${year}.pdf`);
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    printFrame.src = pdfUrl;
    printFrame.onload = () => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    };
    document.body.appendChild(printFrame);
  };

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

  const reportCardProps = {
    student,
    grades,
    term: term!,
    year: year!,
    classTeacher,
    headTeacher: 'Mr. ISABIRYE SALEH',
    classTeacherComment,
    headTeacherComment,
    academicTerm,
    optionalSubjects,
    assignedSubjects,
    positionInClass,
    positionInStream,
    totalStudentsInClass,
    totalStudentsInStream,
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto px-4 no-print mb-4 flex justify-between items-center flex-wrap gap-3">
        <a href="/dashboard/student" className="text-blue-800 font-semibold hover:underline">
          ← Back to Dashboard
        </a>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!pdfBlob}
            className="bg-blue-900 text-white px-4 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!pdfUrl}
            className="bg-white border border-blue-900 text-blue-900 px-4 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Print
          </button>
        </div>
      </div>

      {generatingPdf && (
        <div className="max-w-[210mm] mx-auto px-4 no-print flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900 mr-3" />
          <span className="text-gray-700">Preparing your report card...</span>
        </div>
      )}

      {pdfUrl && (
        <div className="max-w-[210mm] mx-auto px-4 no-print">
          <embed
            src={pdfUrl}
            type="application/pdf"
            className="w-full rounded-lg shadow-lg border border-gray-300"
            style={{ height: '85vh' }}
          />
        </div>
      )}

      {pdfError && (
        <div className="max-w-[210mm] mx-auto px-4 no-print">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm mb-4">
            {pdfError}
          </div>
          <ReportCard {...reportCardProps} />
        </div>
      )}

      {/* Hidden container used to capture the same high-res image the ZIP produces */}
      <div
        ref={pdfContainerRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '210mm',
          backgroundColor: 'white',
          zIndex: -1,
        }}
      >
        <div className="pdf-report-card" style={{ width: '210mm', pageBreakInside: 'avoid' }}>
          <ReportCard {...reportCardProps} forPdfCapture />
        </div>
      </div>
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
