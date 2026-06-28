'use client';

import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { getCurrentTerm } from '@/lib/academic-calendar';
import { withRetry } from '@/lib/retry';
import AdminSidebar from '@/components/sidebar/AdminSidebar';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper function for fetch with retry
const fetchWithRetry = async (url: string, options?: RequestInit) => {
  return await withRetry(async () => {
    const response = await fetch(url, options);
    return response;
  }, 3, 1000);
};

import {
  ReportCard,
  getClassLevel,
  normalizeReportGrades,
  isSeniorSecondaryClass,
  type Student,
  type Grade,
  type AcademicTerm,
} from '@/components/reports/report-card';

export default function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfCurrentStudentIndex, setPdfCurrentStudentIndex] = useState(-1); // For one-at-a-time rendering
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const studentSubjectDataCache = useRef<Map<string, {
    optionalSubjects: Array<{ id: string; name: string }>;
    assignedSubjects: Array<{ id: string; subject_id?: string; name: string; subject_type: string }>;
  }>>(new Map());
  
  // Get current term and year for defaults
  const currentTermData = getCurrentTerm();
  const getTermNumber = (termName: string) => {
    if (termName.includes('I') && !termName.includes('II')) return '1';
    if (termName.includes('II')) return '2';
    if (termName.includes('III')) return '3';
    return '1';
  };
  
  const [selectedTerm, setSelectedTerm] = useState(getTermNumber(currentTermData.name));
  const [selectedYear, setSelectedYear] = useState(currentTermData.academicYear.toString());
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [isPublished, setIsPublished] = useState(false);
  const [classTeachers, setClassTeachers] = useState<{ [key: string]: string }>({});
  const [classes, setClasses] = useState<any[]>([]);
  const [allStreams, setAllStreams] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewOptionalSubjects, setPreviewOptionalSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [previewAssignedSubjects, setPreviewAssignedSubjects] = useState<Array<{ id: string; name: string; subject_type: string }>>([]);
  const [previewComments, setPreviewComments] = useState<{ class_teacher_comment?: string; head_teacher_comment?: string } | null>(null);
  const [previewAcademicTerm, setPreviewAcademicTerm] = useState<AcademicTerm | null>(null);
  const [printAllReports, setPrintAllReports] = useState(false);

  useEffect(() => {
    fetchClassesAndStreams();
  }, []);

  const fetchClassesAndStreams = async () => {
    try {
      const response = await fetchWithRetry('/api/classes');
      const result = await response.json();
      if (result.data) {
        setClasses(result.data.classes || []);
        setAllStreams(result.data.streams || []);
        setStreams(result.data.streams || []);
      }
    } catch (error) {
      console.error('Error fetching classes and streams:', error);
    }
  };

  const fetchClassTeachers = async (studentList: Student[]) => {
    const teacherMap: { [key: string]: string } = {};
    
    for (const student of studentList) {
      const key = `${student.class}-${student.stream}`;
      if (!teacherMap[key]) {
        try {
          const response = await fetchWithRetry(`/api/students/${student.id}/class-teacher`);
          if (response.ok) {
            const result = await response.json();
            teacherMap[key] = result.data || 'Not Assigned';
          } else {
            teacherMap[key] = 'Not Assigned';
          }
        } catch (error) {
          console.error('Error fetching class teacher:', error);
          teacherMap[key] = 'Not Assigned';
        }
      }
    }
    
    setClassTeachers(teacherMap);
  };

  const updateFilteredStreams = (classId: string) => {
    if (classId === 'ALL') {
      setStreams(allStreams);
      setSelectedStream('ALL');
      return;
    }

    const selectedClassObj = classes.find((cls: any) => cls.name === classId);
    const classIdValue = selectedClassObj?.id;

    if (classIdValue) {
      const classStreams = allStreams.filter((stream: any) => stream.class_id === classIdValue);
      setStreams(classStreams);
      setSelectedStream('ALL');
    }
  };

  useEffect(() => {
    if (selectedClass) {
      updateFilteredStreams(selectedClass);
    }
  }, [selectedClass, allStreams]);

  useEffect(() => {
    if (selectedTerm && selectedYear && selectedClass && selectedStream) {
      fetchReportData();
    }
  }, [selectedTerm, selectedYear, selectedClass, selectedStream]);

  // Fetch optional/assigned subjects when preview student changes
  useEffect(() => {
    if (!previewStudent) {
      setPreviewOptionalSubjects([]);
      setPreviewAssignedSubjects([]);
      return;
    }

    const fetchSubjectData = async () => {
      try {
        const classLevel = getClassLevel(previewStudent.class);
        
        if (classLevel === 'S1-S2' || classLevel === 'S3-S4') {
          // Fetch optional subjects for S1-S4
          const response = await fetchWithRetry(`/api/student-optional-subjects?student_id=${previewStudent.id}`);
          if (response.ok) {
            const result = await response.json();
            const optionalSubjects = (result.data || []).map((item: any) => ({
              id: item.id,
              name: item.subjects?.name || ''
            }));
            setPreviewOptionalSubjects(optionalSubjects);
          }
        } else if (classLevel === 'S5-S6') {
          // Fetch assigned subjects for S5-S6
          const response = await fetchWithRetry(`/api/student-subjects?student_id=${previewStudent.id}`);
          if (response.ok) {
            const result = await response.json();
            const assignedSubjects = (result.data || []).map((item: any) => ({
              id: item.id,
              subject_id: item.subject_id,
              name: item.subjects?.name || '',
              subject_type: item.subject_type || item.subjects?.subject_type || ''
            }));
            setPreviewAssignedSubjects(assignedSubjects);
          }
        }

        // Fetch comments and term dates for the preview
        const reportResponse = await fetchWithRetry(`/api/report?student_id=${previewStudent.id}&term=${selectedTerm}&year=${selectedYear}`);
        if (reportResponse.ok) {
          const reportResult = await reportResponse.json();
          const comments = reportResult.data?.comments || {};
          setPreviewComments({
            class_teacher_comment: comments.class_teacher_comment || comments.class_teacher_comment_text || comments.class_teacher || comments.class_teacher_comments || '',
            head_teacher_comment: comments.head_teacher_comment || comments.head_teacher_comment_text || comments.head_teacher || comments.head_teacher_comments || ''
          });
        } else {
          setPreviewComments(null);
        }

        const academicResponse = await fetchWithRetry('/api/academic/overview');
        if (academicResponse.ok) {
          const overview = await academicResponse.json();
          const yearItem = (overview.academic_years || []).find((y: any) => y.year_label === selectedYear);
          const currentTermNumber = Number(selectedTerm);
          if (yearItem) {
            const currentTerm = (overview.terms || []).find((t: any) => Number(t.term_number) === currentTermNumber && t.year_id === yearItem.id);
            let nextTermStart = '';

            if (currentTerm) {
              const nextTerm = (overview.terms || []).find((t: any) => Number(t.term_number) === currentTermNumber + 1 && t.year_id === yearItem.id)
                || (currentTermNumber === 3 ? (overview.terms || []).find((t: any) => Number(t.term_number) === 1 && overview.academic_years?.find((y: any) => y.id === t.year_id)?.year_label === String(Number(selectedYear) + 1)) : null);

              nextTermStart = nextTerm?.start_date || '';
              setPreviewAcademicTerm({
                end_date: currentTerm.end_date,
                next_term_start_date: nextTermStart
              });
            } else {
              setPreviewAcademicTerm(null);
            }
          } else {
            setPreviewAcademicTerm(null);
          }
        } else {
          setPreviewAcademicTerm(null);
        }
      } catch (error) {
        console.error('Error fetching subject data:', error);
      }
    };

    fetchSubjectData();
  }, [previewStudent, selectedTerm, selectedYear]);

  const fetchReportData = async () => {
    if (!selectedStream) return;
    
    try {
      setLoading(true);
      
      let transformedStudents: Student[] = [];
      
      if (selectedClass === 'ALL' && selectedStream === 'ALL') {
        const studentsResponse = await fetchWithRetry('/api/students');
        const studentsResult = await studentsResponse.json();
        
        if (studentsResponse.ok) {
          transformedStudents = (studentsResult.data || []).map((student: any) => ({
            ...student,
            class: student.classes?.name || student.class_id || 'Unknown',
            stream: student.streams?.name || student.stream_id || 'Unknown'
          }));
          setStudents(transformedStudents);
          fetchClassTeachers(transformedStudents);
        }

        const gradesResponse = await fetchWithRetry(`/api/reports?term=${selectedTerm}&year=${selectedYear}`);
        const gradesResult = await gradesResponse.json();
        
        if (gradesResponse.ok) {
          const normalized = normalizeReportGrades(gradesResult.data?.grades || []);
          setGrades(normalized);
          setIsPublished(Boolean(gradesResult.data?.is_published));

          // Merge totals (if provided) into student objects so previews display total points and comments
          const totals = gradesResult.data?.totals || {};
          if (Object.keys(totals).length > 0) {
            const merged = transformedStudents.map((st: any) => ({
              ...st,
              total_uace_points: st.total_uace_points ?? (totals[st.id]?.total_points ?? st.total_uace_points),
              auto_class_teacher_comment: totals[st.id]?.class_teacher_comment,
              auto_head_teacher_comment: totals[st.id]?.head_teacher_comment
            }));
            setStudents(merged);
            computePositions(merged, normalized);
          } else {
            computePositions(transformedStudents, normalized);
          }
        }
      } else {
        const params = new URLSearchParams();
        if (selectedClass !== 'ALL') {
          params.append('class_id', selectedClass.toLowerCase());
        }
        if (selectedStream !== 'ALL') {
          params.append('stream_id', selectedStream);
        }
        
        const studentsResponse = await fetchWithRetry(`/api/students?${params.toString()}`);
        const studentsResult = await studentsResponse.json();
        
        if (studentsResponse.ok) {
          transformedStudents = (studentsResult.data || []).map((student: any) => ({
            ...student,
            class: student.classes?.name || student.class_id?.toUpperCase() || selectedClass,
            stream: student.streams?.name || student.stream_id?.split('-').pop()?.toUpperCase() || selectedStream
          }));
          setStudents(transformedStudents);
          fetchClassTeachers(transformedStudents);
        }

        const gradesParams = new URLSearchParams();
        gradesParams.append('term', selectedTerm);
        gradesParams.append('year', selectedYear);
        if (selectedClass !== 'ALL') gradesParams.append('class_id', selectedClass.toLowerCase());
        if (selectedStream !== 'ALL') gradesParams.append('stream_id', selectedStream);
        
        const gradesResponse = await fetchWithRetry(`/api/reports?${gradesParams.toString()}`);
        const gradesResult = await gradesResponse.json();
        
        if (gradesResponse.ok) {
          const normalized = normalizeReportGrades(gradesResult.data?.grades || []);
          setGrades(normalized);
          setIsPublished(Boolean(gradesResult.data?.is_published));

          const totals = gradesResult.data?.totals || {};
          const merged = transformedStudents.map((st: any) => ({
            ...st,
            total_uace_points: st.total_uace_points ?? (totals[st.id]?.total_points ?? st.total_uace_points),
            auto_class_teacher_comment: totals[st.id]?.class_teacher_comment,
            auto_head_teacher_comment: totals[st.id]?.head_teacher_comment
          }));
          setStudents(merged);
          computePositions(merged, normalized);
        }
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helpers for computing positions

  const computePositions = (studentList: Student[], gradeList: Grade[]) => {
    // Build maps for class and stream groups
    const byClass: { [key: string]: string[] } = {};
    const byStream: { [key: string]: string[] } = {};

    // compute metrics per student
    const metrics: { [studentId: string]: { avg: number; points: number } } = {};

    for (const s of studentList) {
      byClass[s.class] = byClass[s.class] || [];
      byClass[s.class].push(s.id);
      const streamKey = `${s.class}-${s.stream}`;
      byStream[streamKey] = byStream[streamKey] || [];
      byStream[streamKey].push(s.id);
    }

    // aggregate grades
    const gradeMap: { [id: string]: Grade[] } = {};
    for (const g of gradeList) {
      gradeMap[g.student_id] = gradeMap[g.student_id] || [];
      gradeMap[g.student_id].push(g);
    }

    for (const s of studentList) {
      const g = gradeMap[s.id] || [];
      const totalScore = g.reduce((sum, x) => sum + (x.final_score || 0), 0);
      const avg = g.length > 0 ? Math.round(totalScore / g.length) : 0;
      const totalPoints = g.reduce((sum, x) => sum + (x.uace_points ?? x.points ?? 0), 0);
      metrics[s.id] = { avg, points: totalPoints };
    }

    // For each class, sort and assign positions depending on class level
    const classPositions: { [id: string]: number } = {};
    const streamPositions: { [id: string]: number } = {};

    const getClassLevelKey = (clsName: string) => clsName?.toUpperCase();

    for (const cls of Object.keys(byClass)) {
      const ids = byClass[cls];
      // decide ranking metric: S5/S6 -> points, else avg
      const usePoints = isSeniorSecondaryClass(cls);
      const sorted = [...ids].sort((a, b) => {
        const ma = metrics[a] || { avg: 0, points: 0 };
        const mb = metrics[b] || { avg: 0, points: 0 };
        const va = usePoints ? ma.points : ma.avg;
        const vb = usePoints ? mb.points : mb.avg;
        return vb - va; // descending
      });
      sorted.forEach((studentId, idx) => {
        classPositions[studentId] = idx + 1;
      });
    }

    for (const streamKey of Object.keys(byStream)) {
      const ids = byStream[streamKey];
      // stream's class is left part
      const cls = streamKey.split('-')[0];
      const usePoints = isSeniorSecondaryClass(cls);
      const sorted = [...ids].sort((a, b) => {
        const ma = metrics[a] || { avg: 0, points: 0 };
        const mb = metrics[b] || { avg: 0, points: 0 };
        const va = usePoints ? ma.points : ma.avg;
        const vb = usePoints ? mb.points : mb.avg;
        return vb - va;
      });
      sorted.forEach((studentId, idx) => {
        streamPositions[studentId] = idx + 1;
      });
    }

    // attach positions to students in-place by extending student objects
    const updated = studentList.map(s => ({ ...s, _positionInClass: classPositions[s.id] || undefined, _positionInStream: streamPositions[s.id] || undefined }));
    setStudents(updated);

    // store helper maps on window for preview lookup (simple approach)
    (window as any).__report_positions = {
      classPositions,
      streamPositions,
      totals: {
        byClass: Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, v.length])),
        byStream: Object.fromEntries(Object.entries(byStream).map(([k, v]) => [k, v.length]))
      }
    };
  };

  const handlePublishResults = async () => {
    if (selectedClass === 'ALL') {
      alert('Please select a specific class to publish results.');
      return;
    }

    if (!confirm(`Are you sure you want to ${isPublished ? 're-publish' : 'publish'} results for ${selectedClass} ${selectedStream === 'ALL' ? 'all streams' : selectedStream}?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: selectedYear,
          term: selectedTerm,
          class_id: selectedClass.toLowerCase(),
          stream_id: selectedStream === 'ALL' ? undefined : selectedStream,
          published_by: 'admin'
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setIsPublished(true);
        alert('Results published successfully!');
        fetchReportData();
      } else {
        alert('Failed to publish results: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error publishing results:', error);
      alert('Error publishing results');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReport = (student: Student) => {
    // Ensure we use the latest merged student object (with totals/comments)
    const current = students.find(s => s.id === student.id) || student;
    setPreviewStudent(current);
    setShowPreview(true);
  };

  const handlePrintFromPreview = () => {
    // Don't close the preview! We need the report card to be in the DOM when we print
    window.print();
  };

  const handlePrintAll = () => {
    setPrintAllReports(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintAllReports(false);
      }, 500);
    }, 100);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewStudent(null);
  };

  const fetchSubjectDataForStudent = async (student: Student) => {
    const classLevel = getClassLevel(student.class);
    const result = {
      optionalSubjects: [] as Array<{ id: string; name: string }>,
      assignedSubjects: [] as Array<{ id: string; subject_id?: string; name: string; subject_type: string }>,
    };

    if (classLevel === 'S1-S2' || classLevel === 'S3-S4') {
      const response = await fetchWithRetry(`/api/student-optional-subjects?student_id=${student.id}`);
      if (response.ok) {
        const apiResult = await response.json();
        result.optionalSubjects = (apiResult.data || []).map((item: any) => ({
          id: item.id,
          name: item.subjects?.name || '',
        }));
      }
    } else if (classLevel === 'S5-S6') {
      const response = await fetchWithRetry(`/api/student-subjects?student_id=${student.id}`);
      if (response.ok) {
        const apiResult = await response.json();
        result.assignedSubjects = (apiResult.data || []).map((item: any) => ({
          id: item.id,
          subject_id: item.subject_id,
          name: item.subjects?.name || '',
          subject_type: item.subject_type || item.subjects?.subject_type || '',
        }));
      }
    }

    studentSubjectDataCache.current.set(student.id, result);
    return result;
  };

  const prefetchSubjectDataForStudents = async (studentList: Student[]) => {
    await Promise.all(studentList.map((student) => fetchSubjectDataForStudent(student)));
  };

  const waitForImages = async (element: HTMLElement) => {
    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );
  };

  const generatePDF = async () => {
    if (loading) {
      alert('Please wait for data to load first!');
      return;
    }

    if (students.length === 0) {
      alert('No students to generate PDF for!');
      return;
    }

    // Check if all students have grades
    const studentsWithoutGrades = students.filter(s => {
      const studentGrades = grades.filter(g => g.student_id === s.id);
      return studentGrades.length === 0;
    });

    if (studentsWithoutGrades.length > 0) {
      const count = studentsWithoutGrades.length;
      if (!confirm(`${count} student(s) have no grades recorded. Generate PDF anyway? They will show empty report cards.`)) {
        return;
      }
    }

    if (!confirm(`Generate PDF for ${students.length} student(s)? This may take a while.`)) {
      return;
    }

    setPdfGenerating(true);

    try {
      console.log('Starting PDF generation...');
      await prefetchSubjectDataForStudents(students);

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();

      // Process each student one at a time
      for (let i = 0; i < students.length; i++) {
        console.log(`Processing student ${i + 1}/${students.length}`);
        
        // Render current student with flushSync to force immediate update
        flushSync(() => {
          setPdfCurrentStudentIndex(i);
        });
        
        // Wait for React to render and images to load
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Get the report card element
        const reportCardElement = pdfContainerRef.current?.querySelector('.pdf-report-card') as HTMLElement;
        if (!reportCardElement) continue;

        await waitForImages(reportCardElement);
        
        const canvas = await html2canvas(reportCardElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          imageTimeout: 15000,
          ignoreElements: (element) => element.tagName === 'SCRIPT',
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        
        // Add new page if not first
        if (i > 0) {
          pdf.addPage();
        }
        
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeight);
      }

      console.log('PDF generated, downloading...');
      const fileName = `Report_Cards_${selectedYear}_Term_${selectedTerm}.pdf`;
      pdf.save(fileName);
      alert('PDF generated and downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF! Check console for details.');
    } finally {
      flushSync(() => {
        setPdfCurrentStudentIndex(-1);
      });
      setPdfGenerating(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex overflow-hidden relative">
      {/* Print-only content (always at top level) */}
      {printAllReports && (
        <div className="print-only absolute top-0 left-0 w-full bg-white p-0">
          {students.map((student) => {
            const classLevel = getClassLevel(student.class);
            let optionalSubjectsForStudent: Array<{ id: string; name: string }> = [];
            let assignedSubjectsForStudent: Array<{ id: string; subject_id?: string; name: string; subject_type: string }> = [];
            
            if (classLevel === 'S1-S2' || classLevel === 'S3-S4') {
              optionalSubjectsForStudent = previewOptionalSubjects;
            } else {
              assignedSubjectsForStudent = previewAssignedSubjects;
            }

            return (
              <div key={student.id}>
                <ReportCard
                  student={student}
                  grades={grades.filter(g => g.student_id === student.id)}
                  term={selectedTerm}
                  year={selectedYear}
                  classTeacher={classTeachers[`${student.class}-${student.stream}`] || 'Not Assigned'}
                  headTeacher="Mr. ISABIRYE SALEH"
                  classTeacherComment={(student as any)?.auto_class_teacher_comment || ''}
                  headTeacherComment={(student as any)?.auto_head_teacher_comment || ''}
                  academicTerm={previewAcademicTerm || undefined}
                  optionalSubjects={optionalSubjectsForStudent}
                  assignedSubjects={assignedSubjectsForStudent}
                  positionInClass={(student as any)?._positionInClass}
                  positionInStream={(student as any)?._positionInStream}
                  totalStudentsInClass={(window as any).__report_positions?.totals?.byClass?.[student.class]}
                  totalStudentsInStream={(window as any).__report_positions?.totals?.byStream?.[`${student.class}-${student.stream}`]}
                />
              </div>
            );
          })}
        </div>
      )}
      {showPreview && previewStudent && (
        <div className="print-only absolute top-0 left-0 w-full bg-white p-0">
          <div>
            <ReportCard
              student={previewStudent}
              grades={grades.filter(g => g.student_id === previewStudent.id)}
              term={selectedTerm}
              year={selectedYear}
              classTeacher={classTeachers[`${previewStudent.class}-${previewStudent.stream}`] || 'Not Assigned'}
              headTeacher="Mr. ISABIRYE SALEH"
              classTeacherComment={previewComments?.class_teacher_comment || (previewStudent as any)?.auto_class_teacher_comment || ''}
              headTeacherComment={previewComments?.head_teacher_comment || (previewStudent as any)?.auto_head_teacher_comment || ''}
              academicTerm={previewAcademicTerm || undefined}
              optionalSubjects={previewOptionalSubjects}
              assignedSubjects={previewAssignedSubjects}
              positionInClass={(previewStudent as any)?._positionInClass || (window as any).__report_positions?.classPositions?.[previewStudent.id]}
              positionInStream={(previewStudent as any)?._positionInStream || (window as any).__report_positions?.streamPositions?.[previewStudent.id]}
              totalStudentsInClass={(window as any).__report_positions?.totals?.byClass?.[previewStudent.class]}
              totalStudentsInStream={(window as any).__report_positions?.totals?.byStream?.[`${previewStudent.class}-${previewStudent.stream}`]}
            />
          </div>
        </div>
      )}
      {/* Normal screen content */}
      <style>{`
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>
      <div className="no-print">
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      </div>

      <div className={`flex-1 h-full overflow-y-auto transition-all duration-300 pt-16 lg:pt-0 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          <div className="mb-8 text-center no-print">
            <h1 className="text-4xl font-bold text-black mb-2">Report Cards Management</h1>
            <p className="text-black">Generate and manage student academic reports</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 no-print">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-black mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Academic Filters
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Academic Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Term</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="1">Term I</option>
                  <option value="2">Term II</option>
                  <option value="3">Term III</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="ALL">ALL CLASSES</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.name}>{cls.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Stream</label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="ALL">ALL STREAMS</option>
                  {streams.map((stream) => (
                    <option key={stream.id} value={stream.id}>{stream.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 no-print">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-black">
                  {selectedClass === 'ALL' && selectedStream === 'ALL' 
                    ? 'ALL CLASSES - ALL STREAMS' 
                    : `${selectedClass} ${streams.find(s => s.id === selectedStream)?.name || ''} - Term ${selectedTerm}, ${selectedYear}`
                  }
                </h2>
                <p className="text-black mt-1">{students.length} students found</p>
                {isPublished && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 mt-2">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Published
                  </span>
                )}
              </div>
              <div className="flex space-x-3 flex-wrap">
                <button
                  onClick={handlePrintAll}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-md font-bold"
                  disabled={pdfGenerating}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print All Reports
                </button>
                <button
                  onClick={generatePDF}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center shadow-md font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={pdfGenerating || loading}
                >
                  {pdfGenerating ? (
                    <>
                      <svg className="animate-spin w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {pdfCurrentStudentIndex >= 0 
                        ? `Generating PDF (${pdfCurrentStudentIndex + 1}/${students.length})` 
                        : 'Generating PDF...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download PDF
                    </>
                  )}
                </button>
{selectedClass !== 'ALL' && (
                   <button
                     onClick={handlePublishResults}
                     className={`px-6 py-2 rounded-lg transition-colors flex items-center shadow-md font-bold ${
                       isPublished 
                         ? 'bg-amber-500 text-white hover:bg-amber-600' 
                         : 'bg-green-600 text-white hover:bg-green-700'
                     }`}
                   >
                     <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     {isPublished ? 'Re-publish Results' : 'Publish Results'}
                   </button>
                )}
                {selectedClass === 'ALL' && (
                  <div className="text-sm text-gray-600 mt-2">
                    Select a specific class before publishing. The publish button appears after you choose a class.
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center items-center py-12 no-print">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-black">Loading report data...</span>
            </div>
          )}

          {!loading && students.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden no-print">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                <h3 className="text-lg font-bold text-white">Students List</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {students.map((student) => (
                  <div key={student.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                          <span className="text-blue-900 font-bold text-sm">
                            {student.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-black">{student.full_name}</h4>
                          <p className="text-sm text-black">
                            {student.class} - {student.stream}
                            {isSeniorSecondaryClass(student.class) && student.subject_combination && (
                              <span className="ml-2 text-blue-600">({student.subject_combination})</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePrintReport(student)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && students.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center no-print">
              <svg className="w-16 h-16 text-black mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-black mb-2">No Students Found</h3>
              <p className="text-black">No students found for the selected class and stream combination.</p>
            </div>
          )}

          {showPreview && previewStudent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print">
              <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-gray-200 p-4 flex justify-between items-center no-print">
                  <h3 className="text-lg font-bold text-white">Report Card - {previewStudent.full_name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrintFromPreview()}
                      className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center font-semibold"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print Now
                    </button>
                    <button
                      onClick={handleClosePreview}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <ReportCard
                    student={previewStudent}
                    grades={grades.filter(g => g.student_id === previewStudent.id)}
                    term={selectedTerm}
                    year={selectedYear}
                    classTeacher={classTeachers[`${previewStudent.class}-${previewStudent.stream}`] || 'Not Assigned'}
                    headTeacher="Mr. ISABIRYE SALEH"
                    classTeacherComment={previewComments?.class_teacher_comment || (previewStudent as any)?.auto_class_teacher_comment || ''}
                    headTeacherComment={previewComments?.head_teacher_comment || (previewStudent as any)?.auto_head_teacher_comment || ''}
                    academicTerm={previewAcademicTerm || undefined}
                    optionalSubjects={previewOptionalSubjects}
                    assignedSubjects={previewAssignedSubjects}
                    positionInClass={(previewStudent as any)?._positionInClass || (window as any).__report_positions?.classPositions?.[previewStudent.id]}
                    positionInStream={(previewStudent as any)?._positionInStream || (window as any).__report_positions?.streamPositions?.[previewStudent.id]}
                    totalStudentsInClass={(window as any).__report_positions?.totals?.byClass?.[previewStudent.class]}
                    totalStudentsInStream={(window as any).__report_positions?.totals?.byStream?.[`${previewStudent.class}-${previewStudent.stream}`]}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Hidden container for PDF generation - completely separate styling */}
          <div 
            ref={pdfContainerRef} 
            className="fixed"
            style={{
              left: '-9999px',
              top: '0',
              width: '210mm',
              backgroundColor: 'white',
              zIndex: -1,
              lineHeight: 'normal',
              fontSize: '16px',
              overflow: 'visible'
            }}
          >
            {pdfCurrentStudentIndex >= 0 && students[pdfCurrentStudentIndex] && (() => {
              const student = students[pdfCurrentStudentIndex];
              const cachedSubjects = studentSubjectDataCache.current.get(student.id);
              const optionalSubjectsForStudent = cachedSubjects?.optionalSubjects || [];
              const assignedSubjectsForStudent = cachedSubjects?.assignedSubjects || [];

              return (
                <div 
                  className="pdf-report-card"
                  style={{
                    width: '210mm',
                    padding: '0',
                    margin: '0',
                    pageBreakInside: 'avoid'
                  }}
                >
                  <ReportCard
                    student={student}
                    grades={grades.filter(g => g.student_id === student.id)}
                    term={selectedTerm}
                    year={selectedYear}
                    classTeacher={classTeachers[`${student.class}-${student.stream}`] || 'Not Assigned'}
                    headTeacher="Mr. ISABIRYE SALEH"
                    classTeacherComment={(student as any)?.auto_class_teacher_comment || ''}
                    headTeacherComment={(student as any)?.auto_head_teacher_comment || ''}
                    academicTerm={previewAcademicTerm || undefined}
                    optionalSubjects={optionalSubjectsForStudent}
                    assignedSubjects={assignedSubjectsForStudent}
                    positionInClass={(student as any)?._positionInClass}
                    positionInStream={(student as any)?._positionInStream}
                    totalStudentsInClass={(window as any).__report_positions?.totals?.byClass?.[student.class]}
                    totalStudentsInStream={(window as any).__report_positions?.totals?.byStream?.[`${student.class}-${student.stream}`]}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfCurrentStudentIndex, setPdfCurrentStudentIndex] = useState(-1);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const currentTermData = getCurrentTerm();
  const getTermNumber = (termName: string) => {
    if (termName.includes('I') && !termName.includes('II')) return '1';
    if (termName.includes('II')) return '2';
    if (termName.includes('III')) return '3';
    return '1';
  };

  const [selectedTerm, setSelectedTerm] = useState(getTermNumber(currentTermData.name));
  const [selectedYear, setSelectedYear] = useState(currentTermData.academicYear.toString());
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [isPublished, setIsPublished] = useState(false);
  const [classTeachers, setClassTeachers] = useState<{ [key: string]: string }>({});
  const [classes, setClasses] = useState<any[]>([]);
  const [allStreams, setAllStreams] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewOptionalSubjects, setPreviewOptionalSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [previewAssignedSubjects, setPreviewAssignedSubjects] = useState<Array<{ id: string; subject_id?: string; name: string; subject_type: string }>>([]);
  const [previewComments, setPreviewComments] = useState<{ class_teacher_comment?: string; head_teacher_comment?: string } | null>(null);
  const [previewAcademicTerm, setPreviewAcademicTerm] = useState<AcademicTerm | null>(null);
  const [printAllReports, setPrintAllReports] = useState(false);

  useEffect(() => {
    fetchClassesAndStreams();
  }, []);

  const fetchClassesAndStreams = async () => {
    try {
      const response = await fetchWithRetry('/api/classes');
      const result = await response.json();
      if (result.data) {
        setClasses(result.data.classes || []);
        setAllStreams(result.data.streams || []);
        setStreams(result.data.streams || []);
      }
    } catch (error) {
      console.error('Error fetching classes and streams:', error);
    }
  };

  const fetchClassTeachers = async (studentList: Student[]) => {
    const teacherMap: { [key: string]: string } = {};
    for (const student of studentList) {
      const key = `${student.class}-${student.stream}`;
      if (!teacherMap[key]) {
        try {
          const response = await fetchWithRetry(`/api/students/${student.id}/class-teacher`);
          if (response.ok) {
            const result = await response.json();
            teacherMap[key] = result.data || 'Not Assigned';
          } else {
            teacherMap[key] = 'Not Assigned';
          }
        } catch (error) {
          console.error('Error fetching class teacher:', error);
          teacherMap[key] = 'Not Assigned';
        }
      }
    }
    setClassTeachers(teacherMap);
  };

  const updateFilteredStreams = (classId: string) => {
    if (classId === 'ALL') {
      setStreams(allStreams);
      setSelectedStream('ALL');
      return;
    }
    const selectedClassObj = classes.find((cls: any) => cls.name === classId);
    const classIdValue = selectedClassObj?.id;
    if (classIdValue) {
      const classStreams = allStreams.filter((stream: any) => stream.class_id === classIdValue);
      setStreams(classStreams);
      setSelectedStream('ALL');
    }
  };

  useEffect(() => {
    if (selectedClass) {
      updateFilteredStreams(selectedClass);
    }
  }, [selectedClass, allStreams]);

  useEffect(() => {
    if (selectedTerm && selectedYear && selectedClass && selectedStream) {
      fetchReportData();
    }
  }, [selectedTerm, selectedYear, selectedClass, selectedStream]);

  useEffect(() => {
    if (!previewStudent) {
      setPreviewOptionalSubjects([]);
      setPreviewAssignedSubjects([]);
      return;
    }
    const fetchSubjectData = async () => {
      try {
        const classLevel = getClassLevel(previewStudent.class);
        if (classLevel === 'S1-S2' || classLevel === 'S3-S4') {
          const response = await fetchWithRetry(`/api/student-optional-subjects?student_id=${previewStudent.id}`);
          if (response.ok) {
            const result = await response.json();
            setPreviewOptionalSubjects((result.data || []).map((item: any) => ({
              id: item.id,
              name: item.subjects?.name || ''
            })));
          }
        } else if (classLevel === 'S5-S6') {
          const response = await fetchWithRetry(`/api/student-subjects?student_id=${previewStudent.id}`);
          if (response.ok) {
            const result = await response.json();
            setPreviewAssignedSubjects((result.data || []).map((item: any) => ({
              id: item.id,
              subject_id: item.subject_id,
              name: item.subjects?.name || '',
              subject_type: item.subject_type || item.subjects?.subject_type || ''
            })));
          }
        }
        const reportResponse = await fetchWithRetry(`/api/report?student_id=${previewStudent.id}&term=${selectedTerm}&year=${selectedYear}`);
        if (reportResponse.ok) {
          const reportResult = await reportResponse.json();
          setPreviewComments({
            class_teacher_comment: reportResult.data?.comments?.class_teacher_comment || (previewStudent as any)?.auto_class_teacher_comment || '',
            head_teacher_comment: reportResult.data?.comments?.head_teacher_comment || (previewStudent as any)?.auto_head_teacher_comment || ''
          });
        }
        const academicResponse = await fetchWithRetry('/api/academic/overview');
        if (academicResponse.ok) {
          const overview = await academicResponse.json();
          const yearItem = (overview.academic_years || []).find((y: any) => y.year_label === selectedYear);
          const currentTermNumber = Number(selectedTerm);
          if (yearItem) {
            const currentTerm = (overview.terms || []).find((t: any) => Number(t.term_number) === currentTermNumber && t.year_id === yearItem.id);
            let nextTermStart = '';
            if (currentTerm) {
              const nextTerm = (overview.terms || []).find((t: any) => Number(t.term_number) === currentTermNumber + 1 && t.year_id === yearItem.id)
                || (currentTermNumber === 3 ? (overview.terms || []).find((t: any) => Number(t.term_number) === 1 && overview.academic_years?.find((y: any) => y.id === t.year_id)?.year_label === String(Number(selectedYear) + 1)) : null);
              nextTermStart = nextTerm?.start_date || '';
              setPreviewAcademicTerm({
                end_date: currentTerm.end_date,
                next_term_start_date: nextTermStart
              });
            } else {
              setPreviewAcademicTerm(null);
            }
          } else {
            setPreviewAcademicTerm(null);
          }
        } else {
          setPreviewAcademicTerm(null);
        }
      } catch (error) {
        console.error('Error fetching subject data:', error);
      }
    };
    fetchSubjectData();
  }, [previewStudent, selectedTerm, selectedYear]);

  const fetchReportData = async () => {
    if (!selectedStream) return;
    try {
      setLoading(true);
      let transformedStudents: Student[] = [];
      if (selectedClass === 'ALL' && selectedStream === 'ALL') {
        const studentsResponse = await fetchWithRetry('/api/students');
        const studentsResult = await studentsResponse.json();
        if (studentsResponse.ok) {
          transformedStudents = (studentsResult.data || []).map((student: any) => ({
            ...student,
            class: student.classes?.name || student.class_id || 'Unknown',
            stream: student.streams?.name || student.stream_id || 'Unknown'
          }));
          setStudents(transformedStudents);
          fetchClassTeachers(transformedStudents);
        }
        const gradesResponse = await fetchWithRetry(`/api/reports?term=${selectedTerm}&year=${selectedYear}`);
        const gradesResult = await gradesResponse.json();
        if (gradesResponse.ok) {
          const normalized = normalizeReportGrades(gradesResult.data?.grades || []);
          setGrades(normalized);
          setIsPublished(Boolean(gradesResult.data?.is_published));
          const totals = gradesResult.data?.totals || {};
          if (Object.keys(totals).length > 0) {
            const merged = transformedStudents.map((st: any) => ({
              ...st,
              total_uace_points: st.total_uace_points ?? (totals[st.id]?.total_points ?? st.total_uace_points),
              auto_class_teacher_comment: totals[st.id]?.class_teacher_comment,
              auto_head_teacher_comment: totals[st.id]?.head_teacher_comment
            }));
            setStudents(merged);
            computePositions(merged, normalized);
          } else {
            computePositions(transformedStudents, normalized);
          }
        }
      } else {
        const params = new URLSearchParams();
        if (selectedClass !== 'ALL') params.append('class_id', selectedClass.toLowerCase());
        if (selectedStream !== 'ALL') params.append('stream_id', selectedStream);
        const studentsResponse = await fetchWithRetry(`/api/students?${params.toString()}`);
        const studentsResult = await studentsResponse.json();
        if (studentsResponse.ok) {
          transformedStudents = (studentsResult.data || []).map((student: any) => ({
            ...student,
            class: student.classes?.name || student.class_id?.toUpperCase() || selectedClass,
            stream: student.streams?.name || student.stream_id?.split('-').pop()?.toUpperCase() || selectedStream
          }));
          setStudents(transformedStudents);
          fetchClassTeachers(transformedStudents);
        }
        const gradesParams = new URLSearchParams();
        gradesParams.append('term', selectedTerm);
        gradesParams.append('year', selectedYear);
        if (selectedClass !== 'ALL') gradesParams.append('class_id', selectedClass.toLowerCase());
        if (selectedStream !== 'ALL') gradesParams.append('stream_id', selectedStream);
        const gradesResponse = await fetchWithRetry(`/api/reports?${gradesParams.toString()}`);
        const gradesResult = await gradesResponse.json();
        if (gradesResponse.ok) {
          const normalized = normalizeReportGrades(gradesResult.data?.grades || []);
          setGrades(normalized);
          setIsPublished(Boolean(gradesResult.data?.is_published));
          const totals = gradesResult.data?.totals || {};
          const merged = transformedStudents.map((st: any) => ({
            ...st,
            total_uace_points: st.total_uace_points ?? (totals[st.id]?.total_points ?? st.total_uace_points),
            auto_class_teacher_comment: totals[st.id]?.class_teacher_comment,
            auto_head_teacher_comment: totals[st.id]?.head_teacher_comment
          }));
          setStudents(merged);
          computePositions(merged, normalized);
        }
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const computePositions = (studentList: Student[], gradeList: Grade[]) => {
    const byClass: { [key: string]: string[] } = {};
    const byStream: { [key: string]: string[] } = {};
    const metrics: { [studentId: string]: { avg: number; points: number } } = {};
    for (const s of studentList) {
      byClass[s.class] = byClass[s.class] || [];
      byClass[s.class].push(s.id);
      const streamKey = `${s.class}-${s.stream}`;
      byStream[streamKey] = byStream[streamKey] || [];
      byStream[streamKey].push(s.id);
    }
    const gradeMap: { [id: string]: Grade[] } = {};
    for (const g of gradeList) {
      gradeMap[g.student_id] = gradeMap[g.student_id] || [];
      gradeMap[g.student_id].push(g);
    }
    for (const s of studentList) {
      const g = gradeMap[s.id] || [];
      const totalScore = g.reduce((sum, x) => sum + (x.final_score || 0), 0);
      const avg = g.length > 0 ? Math.round(totalScore / g.length) : 0;
      const totalPoints = g.reduce((sum, x) => sum + (x.uace_points ?? x.points ?? 0), 0);
      metrics[s.id] = { avg, points: totalPoints };
    }
    const classPositions: { [id: string]: number } = {};
    const streamPositions: { [id: string]: number } = {};
    for (const cls of Object.keys(byClass)) {
      const ids = byClass[cls];
      const usePoints = isSeniorSecondaryClass(cls);
      const sorted = [...ids].sort((a, b) => {
        const ma = metrics[a] || { avg: 0, points: 0 };
        const mb = metrics[b] || { avg: 0, points: 0 };
        const va = usePoints ? ma.points : ma.avg;
        const vb = usePoints ? mb.points : mb.avg;
        return vb - va;
      });
      sorted.forEach((studentId, idx) => {
        classPositions[studentId] = idx + 1;
      });
    }
    for (const streamKey of Object.keys(byStream)) {
      const ids = byStream[streamKey];
      const cls = streamKey.split('-')[0];
      const usePoints = isSeniorSecondaryClass(cls);
      const sorted = [...ids].sort((a, b) => {
        const ma = metrics[a] || { avg: 0, points: 0 };
        const mb = metrics[b] || { avg: 0, points: 0 };
        const va = usePoints ? ma.points : ma.avg;
        const vb = usePoints ? mb.points : mb.avg;
        return vb - va;
      });
      sorted.forEach((studentId, idx) => {
        streamPositions[studentId] = idx + 1;
      });
    }
    const updated = studentList.map(s => ({ ...s, _positionInClass: classPositions[s.id] || undefined, _positionInStream: streamPositions[s.id] || undefined }));
    setStudents(updated);
    (window as any).__report_positions = {
      classPositions,
      streamPositions,
      totals: {
        byClass: Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, v.length])),
        byStream: Object.fromEntries(Object.entries(byStream).map(([k, v]) => [k, v.length]))
      }
    };
  };

  const handlePublishResults = async () => {
    if (selectedClass === 'ALL') {
      alert('Please select a specific class to publish results.');
      return;
    }
    if (!confirm(`Are you sure you want to ${isPublished ? 're-publish' : 'publish'} results for ${selectedClass} ${selectedStream === 'ALL' ? 'all streams' : selectedStream}?`)) {
      return;
    }
    try {
      setLoading(true);
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: selectedYear,
          term: selectedTerm,
          class_id: selectedClass.toLowerCase(),
          stream_id: selectedStream === 'ALL' ? undefined : selectedStream,
          published_by: 'admin'
        })
      });
      const result = await response.json();
      if (response.ok) {
        setIsPublished(true);
        alert('Results published successfully!');
        fetchReportData();
      } else {
        alert('Failed to publish results: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error publishing results:', error);
      alert('Error publishing results');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReport = (student: Student) => {
    const current = students.find(s => s.id === student.id) || student;
    setPreviewStudent(current);
    setShowPreview(true);
  };

  const handlePrintFromPreview = () => {
    window.print();
  };

  const handlePrintAll = () => {
    setPrintAllReports(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintAllReports(false);
      }, 500);
    }, 100);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewStudent(null);
  };

  const generatePDF = async () => {
    if (loading) {
      alert('Please wait for data to load first!');
      return;
    }
    if (students.length === 0) {
      alert('No students to generate PDF for!');
      return;
    }
    const studentsWithoutGrades = students.filter(s => {
      const studentGrades = grades.filter(g => g.student_id === s.id);
      return studentGrades.length === 0;
    });
    if (studentsWithoutGrades.length > 0) {
      const count = studentsWithoutGrades.length;
      if (!confirm(`${count} student(s) have no grades recorded. Generate PDF anyway? They will show empty report cards.`)) {
        return;
      }
    }
    if (!confirm(`Generate PDF for ${students.length} student(s)? This may take a while.`)) {
      return;
    }
    setPdfGenerating(true);
    try {
      console.log('Starting PDF generation...');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      for (let i = 0; i < students.length; i++) {
        console.log(`Processing student ${i + 1}/${students.length}`);
        flushSync(() => {
          setPdfCurrentStudentIndex(i);
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        const reportCardElement = pdfContainerRef.current?.querySelector('.pdf-report-card') as HTMLElement;
        if (!reportCardElement) continue;
        const canvas = await html2canvas(reportCardElement, {
          scale: 1.2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          imageTimeout: 5000,
          ignoreElements: (element) => {
            return element.tagName === 'SCRIPT';
          }
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        if (i > 0) {
          pdf.addPage();
        }
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeight);
      }
      console.log('PDF generated, downloading...');
      const fileName = `Report_Cards_${selectedYear}_Term_${selectedTerm}.pdf`;
      pdf.save(fileName);
      alert('PDF generated and downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF! Check console for details.');
    } finally {
      flushSync(() => {
        setPdfCurrentStudentIndex(-1);
      });
      setPdfGenerating(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex overflow-hidden relative">
      {printAllReports && (
        <div className="print-only absolute top-0 left-0 w-full bg-white p-0">
          {students.map((student) => {
            const classLevel = getClassLevel(student.class);
            let optionalSubjectsForStudent: Array<{ id: string; name: string }> = [];
            let assignedSubjectsForStudent: Array<{ id: string; subject_id?: string; name: string; subject_type: string }> = [];
            if (classLevel === 'S1-S2' || classLevel === 'S3-S4') {
              optionalSubjectsForStudent = previewOptionalSubjects;
            } else {
              assignedSubjectsForStudent = previewAssignedSubjects;
            }
            return (
              <div key={student.id}>
                <ReportCard
                  student={student}
                  grades={grades.filter(g => g.student_id === student.id)}
                  term={selectedTerm}
                  year={selectedYear}
                  classTeacher={classTeachers[`${student.class}-${student.stream}`] || 'Not Assigned'}
                  headTeacher="Mr. ISABIRYE SALEH"
                  classTeacherComment={(student as any)?.auto_class_teacher_comment || ''}
                  headTeacherComment={(student as any)?.auto_head_teacher_comment || ''}
                  academicTerm={previewAcademicTerm || undefined}
                  optionalSubjects={optionalSubjectsForStudent}
                  assignedSubjects={assignedSubjectsForStudent}
                  positionInClass={(student as any)?._positionInClass}
                  positionInStream={(student as any)?._positionInStream}
                  totalStudentsInClass={(window as any).__report_positions?.totals?.byClass?.[student.class]}
                  totalStudentsInStream={(window as any).__report_positions?.totals?.byStream?.[`${student.class}-${student.stream}`]}
                />
              </div>
            );
          })}
        </div>
      )}
      {showPreview && previewStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-gray-200 p-4 flex justify-between items-center no-print">
              <h3 className="text-lg font-bold text-white">Report Card - {previewStudent.full_name}</h3>
              <div className="flex gap-2">
                <button onClick={() => handlePrintFromPreview()} className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center font-semibold">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 002 2v4h10z" />
                  </svg>
                  Print Now
                </button>
                <button onClick={handleClosePreview} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-semibold">
                  Close
                </button>
              </div>
            </div>
            <div className="p-4">
              <ReportCard
                student={previewStudent}
                grades={grades.filter(g => g.student_id === previewStudent.id)}
                term={selectedTerm}
                year={selectedYear}
                classTeacher={classTeachers[`${previewStudent.class}-${previewStudent.stream}`] || 'Not Assigned'}
                headTeacher="Mr. ISABIRYE SALEH"
                classTeacherComment={previewComments?.class_teacher_comment || (previewStudent as any)?.auto_class_teacher_comment || ''}
                headTeacherComment={previewComments?.head_teacher_comment || (previewStudent as any)?.auto_head_teacher_comment || ''}
                academicTerm={previewAcademicTerm || undefined}
                optionalSubjects={previewOptionalSubjects}
                assignedSubjects={previewAssignedSubjects}
                positionInClass={(previewStudent as any)?._positionInClass || (window as any).__report_positions?.classPositions?.[previewStudent.id]}
                positionInStream={(previewStudent as any)?._positionInStream || (window as any).__report_positions?.streamPositions?.[previewStudent.id]}
                totalStudentsInClass={(window as any).__report_positions?.totals?.byClass?.[previewStudent.class]}
                totalStudentsInStream={(window as any).__report_positions?.totals?.byStream?.[`${previewStudent.class}-${previewStudent.stream}`]}
              />
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>
      <div className="no-print">
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      </div>
      <div className={`flex-1 h-full overflow-y-auto transition-all duration-300 pt-16 lg:pt-0 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <div className="p-4 lg:p-8">
          <div className="mb-8 text-center no-print">
            <h1 className="text-4xl font-bold text-black mb-2">Report Cards Management</h1>
            <p className="text-black">Generate and manage student academic reports</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 no-print">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-black mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Academic Filters
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Academic Year</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900">
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Term</label>
                <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900">
                  <option value="1">Term I</option>
                  <option value="2">Term II</option>
                  <option value="3">Term III</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Class</label>
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900">
                  <option value="ALL">ALL CLASSES</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.name}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Stream</label>
                <select value={selectedStream} onChange={(e) => setSelectedStream(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900">
                  <option value="ALL">ALL STREAMS</option>
                  {streams.map((stream) => (
                    <option key={stream.id} value={stream.id}>{stream.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 no-print">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-black">
                  {selectedClass === 'ALL' && selectedStream === 'ALL'
                    ? 'ALL CLASSES - ALL STREAMS'
                    : `${selectedClass} ${streams.find(s => s.id === selectedStream)?.name || ''} - Term ${selectedTerm}, ${selectedYear}`
                  }
                </h2>
                <p className="text-black mt-1">{students.length} students found</p>
                {isPublished && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 mt-2">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Published
                  </span>
                )}
              </div>
              <div className="flex space-x-3 flex-wrap">
                <button onClick={handlePrintAll} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-md font-bold" disabled={pdfGenerating}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 002 2v4h10z" />
                  </svg>
                  Print All Reports
                </button>
                <button onClick={generatePDF} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center shadow-md font-bold disabled:opacity-50 disabled:cursor-not-allowed" disabled={pdfGenerating || loading}>
                  {pdfGenerating ? (
                    <>
                      <svg className="animate-spin w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {pdfCurrentStudentIndex >= 0 ? `Generating PDF (${pdfCurrentStudentIndex + 1}/${students.length})` : 'Generating PDF...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download PDF
                    </>
                  )}
                </button>
                {selectedClass !== 'ALL' && (
                  <button onClick={handlePublishResults} className={`px-6 py-2 rounded-lg transition-colors flex items-center shadow-md font-bold ${isPublished ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isPublished ? 'Re-publish Results' : 'Publish Results'}
                  </button>
                )}
                {selectedClass === 'ALL' && (
                  <div className="text-sm text-gray-600 mt-2">
                    Select a specific class before publishing. The publish button appears after you choose a class.
                  </div>
                )}
              </div>
            </div>
          </div>
          {loading && (
            <div className="flex justify-center items-center py-12 no-print">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-black">Loading report data...</span>
            </div>
          )}
          {!loading && students.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden no-print">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                <h3 className="text-lg font-bold text-white">Students List</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {students.map((student) => (
                  <div key={student.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                          <span className="text-blue-900 font-bold text-sm">
                            {student.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-black">{student.full_name}</h4>
                          <p className="text-sm text-black">
                            {student.class} - {student.stream}
                            {isSeniorSecondaryClass(student.class) && student.subject_combination && (
                              <span className="ml-2 text-blue-600">({student.subject_combination})</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handlePrintReport(student)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 002 2v4h10z" />
                        </svg>
                        Print Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!loading && students.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center no-print">
              <svg className="w-16 h-16 text-black mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-black mb-2">No Students Found</h3>
              <p className="text-black">No students found for the selected class and stream combination.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
