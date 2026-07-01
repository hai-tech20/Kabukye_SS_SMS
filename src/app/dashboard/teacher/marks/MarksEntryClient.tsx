'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TeacherSidebar from '@/components/sidebar/TeacherSidebar';
import { getCurrentTerm } from '@/lib/academic-calendar';

type SidebarComponent = React.ComponentType<{ sidebarOpen: boolean; setSidebarOpen: (open: boolean) => void }>;

interface MarksEntryClientProps {
  initialAssignments: Assignment[];
  initialClasses: any[];
  initialStreams: any[];
  initialSubjects: any[];
  teacherId: string;
  error: string | null;
  SidebarComponent?: SidebarComponent;
}

interface Student {
  id: string;
  full_name: string;
  class_id: string;
  stream_id: string;
  schoolpay_code: string;
  status: string;
  classes?: { name: string };
  streams?: { name: string };
}

interface PaperScore {
  paper_number: number;
  score: number;
}

interface GradeEntry {
  student_id: string;
  mot_p1?: number;
  mot_p2?: number;
  mot_p3?: number;
  mot_p4?: number;
  eot_p1?: number;
  eot_p2?: number;
  eot_p3?: number;
  eot_p4?: number;
}

interface Subject {
  id: string;
  name: string;
  paper_count: number;
}

interface Assignment {
  id: string;
  class_id: string;
  stream_id: string;
  subject_id: string;
  classes?: { name: string };
  streams?: { name: string };
  subjects?: { name: string; paper_count: number };
}

export default function MarksEntryClient({
  initialAssignments,
  initialClasses,
  initialStreams,
  initialSubjects,
  teacherId,
  error: initialError
}: MarksEntryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [isPublished, setIsPublished] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(initialAssignments.length > 0);
  
  // Pre-filtered data based on teacher assignments
  const [classes, setClasses] = useState(() => {
    const assignedClassIds = [...new Set(initialAssignments.map((a: any) => a.class_id))];
    return initialClasses.filter((cls: any) => assignedClassIds.includes(cls.id));
  });

  const [allStreams] = useState(initialStreams);
  const [allSubjects] = useState(() => {
    // Convert to Subject interface
    return initialSubjects.map((s: any) => ({
      id: s.id,
      name: s.name,
      paper_count: s.paper_count || 1
    })) as Subject[];
  });
  
  const [streams, setStreams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  const [selectedClass, setSelectedClass] = useState(searchParams.get('class_id') || '');
  const [selectedStream, setSelectedStream] = useState(searchParams.get('stream_id') || '');
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject_id') || '');
  const [selectedSet, setSelectedSet] = useState<'MOT' | 'EOT'>('MOT');
  
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
  const [searchTerm, setSearchTerm] = useState('');

  // Reset edits when filters change
  useEffect(() => {
    setHasEdits(false);
  }, [selectedClass, selectedStream, selectedSubject, selectedTerm, selectedYear, selectedSet]);
  
  // Get current subject and paper count
  const currentSubject = useMemo(() => 
    subjects.find(s => s.id === selectedSubject), 
    [subjects, selectedSubject]
  );
  const paperCount = currentSubject?.paper_count || 1;
  
  // Refs for request deduplication
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

  const isALevel = selectedClass?.toLowerCase().includes('s5') || selectedClass?.toLowerCase().includes('s6');
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const search = searchTerm.toLowerCase();
    return students.filter(student => {
      const fullName = student.full_name?.toLowerCase() || '';
      const schoolPayCode = student.schoolpay_code?.toLowerCase() || '';
      return fullName.includes(search) || schoolPayCode.includes(search);
    });
  }, [students, searchTerm]);

  // Initial load - no need to fetch classes as they're pre-loaded
  // If initial server props had no assignments, try fetching them client-side
  useEffect(() => {
    if (assignmentsLoaded) return;

    const fetchAssignments = async () => {
      try {
        const res = await fetch('/api/teacher/subjects');
        if (!res.ok) {
          setAssignments([]);
          setAssignmentsLoaded(true);
          return;
        }
        const json = await res.json();
        const data = json?.data || json?.assignments || json || [];
        setAssignments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch teacher assignments client-side', err);
        setAssignments([]);
      } finally {
        setAssignmentsLoaded(true);
      }
    };

    fetchAssignments();
  }, [assignmentsLoaded]);

  // Update error state when assignments are known
  useEffect(() => {
    if (assignmentsLoaded && (!assignments || assignments.length === 0)) {
      setError('No subjects assigned to you. Please contact the administrator.');
    } else {
      setError(null);
    }
  }, [assignments, assignmentsLoaded]);

  // Recompute classes when assignments change
  useEffect(() => {
    const assignedClassIds = [...new Set(assignments.map((a: any) => a.class_id))];
    setClasses(initialClasses.filter((cls: any) => assignedClassIds.includes(cls.id)));
  }, [assignments, initialClasses]);

  useEffect(() => {
    const fetchPublishedStatus = async () => {
      if (!selectedClass || !selectedStream || !selectedTerm || !selectedYear) {
        setIsPublished(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.append('academic_year', selectedYear);
        params.append('term', selectedTerm);
        params.append('class_id', selectedClass);
        params.append('stream_id', selectedStream);

        const res = await fetch(`/api/reports?${params.toString()}`);
        if (!res.ok) {
          setIsPublished(false);
          return;
        }

        const json = await res.json();
        setIsPublished(Boolean(json?.data?.is_published));
      } catch (err) {
        console.error('Error fetching published status:', err);
        setIsPublished(false);
      }
    };

    fetchPublishedStatus();
  }, [selectedClass, selectedStream, selectedTerm, selectedYear]);

  // Fetch streams when class changes, and clear stream/subject
  useEffect(() => {
    if (!selectedClass) {
      setStreams([]);
      setSelectedStream('');
      setSelectedSubject('');
      return;
    }

    const relevantAssignments = assignments.filter(a => a.class_id === selectedClass);
    const hasNullStream = relevantAssignments.some(a => a.stream_id == null || a.stream_id === '');
    
    let relevantStreamIds: string[];
    if (hasNullStream) {
      relevantStreamIds = allStreams.filter(s => s.class_id === selectedClass).map(s => s.id);
    } else {
      relevantStreamIds = [...new Set(relevantAssignments.map(a => a.stream_id).filter(Boolean))];
    }
    
    const filteredStreams = allStreams.filter((s: any) => relevantStreamIds.includes(s.id));
    setStreams(filteredStreams);
    
    if (hasNullStream) {
      setSelectedStream('ALL');
    } else {
      setSelectedStream('');
    }
    setSelectedSubject('');
  }, [selectedClass, assignments, allStreams]);

  // Fetch subjects when stream changes, and clear subject
  useEffect(() => {
    if (!selectedClass) {
      setSubjects([]);
      setSelectedSubject('');
      return;
    }

    const relevantAssignments = assignments.filter(a => a.class_id === selectedClass);
    const hasNullStream = relevantAssignments.some(a => a.stream_id == null || a.stream_id === '');
    
    let filteredAssignments: any[];
    if (hasNullStream && (selectedStream === 'ALL' || !selectedStream)) {
      filteredAssignments = relevantAssignments;
    } else if (selectedStream) {
      filteredAssignments = relevantAssignments.filter(
        a => (a.stream_id || '') === selectedStream
      );
    } else {
      setSubjects([]);
      setSelectedSubject('');
      return;
    }
    
    const relevantSubjectIds = [...new Set(filteredAssignments.map(a => a.subject_id))];
    
    const seenSubjectIds = new Set<string>();
    const filteredSubjects = allSubjects.filter((s: any) => {
      if (relevantSubjectIds.includes(s.id) && !seenSubjectIds.has(s.id)) {
        seenSubjectIds.add(s.id);
        return true;
      }
      return false;
    });

    setSubjects(filteredSubjects);
    setSelectedSubject('');
  }, [selectedClass, selectedStream, assignments, allSubjects]);

  // Fetch students and grades with parallel fetching and better abort handling
  useEffect(() => {
    if (!selectedClass || !selectedStream || !selectedSubject) return;

    // Cancel previous request immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setLoading(true);

    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        params.append('class_id', selectedClass);
        if (selectedStream && selectedStream !== 'ALL') {
          params.append('stream_id', selectedStream);
        }
        params.append('subject_id', selectedSubject);
        params.append('term', selectedTerm);
        params.append('academic_year', selectedYear);
        params.append('t', Date.now().toString());

        // Fetch students and grades in parallel to make it faster!
        const [studentsRes, gradesRes] = await Promise.all([
          fetch(`/api/students?${params.toString()}`, {
            signal: abortController.signal,
            cache: 'no-store'
          }),
          fetch(`/api/grades?${params.toString()}`, {
            signal: abortController.signal,
            cache: 'no-store'
          })
        ]);

        if (!studentsRes.ok) throw new Error('Failed to fetch students');
        if (!gradesRes.ok) throw new Error('Failed to fetch grades');

        const [studentsData, gradesData] = await Promise.all([
          studentsRes.json(),
          gradesRes.json()
        ]);

        const studentsList = studentsData.data || [];
        const gradesList = gradesData.data || [];

        // Initialize grades from existing data or empty
        const initialGrades: GradeEntry[] = studentsList.map((s: Student) => {
          const existingGrade = gradesList.find((g: any) => String(g.student_id) === String(s.id));

          // Extract paper scores from grade_papers array or from p1_score, p2_score, p3_score columns
          const paperScores: Record<number, { mot?: number; eot?: number }> = {};

          // First check grade_papers array and respect assessment_type (MOT vs EOT)
          if (existingGrade?.grade_papers && Array.isArray(existingGrade.grade_papers)) {
            for (const paper of existingGrade.grade_papers) {
              if (!paperScores[paper.paper_number]) {
                paperScores[paper.paper_number] = {};
              }
              const atype = (paper.assessment_type || '').toString().toUpperCase();
              const scoreNum = paper.score !== undefined && paper.score !== null ? Number(paper.score) : undefined;
              if (atype === 'EOT') {
                paperScores[paper.paper_number].eot = scoreNum;
              } else {
                paperScores[paper.paper_number].mot = scoreNum;
              }
            }
          }

          const hasSinglePaper = paperCount === 1;

          return {
            student_id: s.id,
            mot_p1: paperScores[1]?.mot ?? (hasSinglePaper ? existingGrade?.mot_score : undefined),
            mot_p2: paperScores[2]?.mot ?? undefined,
            mot_p3: paperScores[3]?.mot ?? undefined,
            mot_p4: paperScores[4]?.mot ?? undefined,
            eot_p1: paperScores[1]?.eot ?? (hasSinglePaper ? existingGrade?.eot_score : undefined),
            eot_p2: paperScores[2]?.eot ?? undefined,
            eot_p3: paperScores[3]?.eot ?? undefined,
            eot_p4: paperScores[4]?.eot ?? undefined
          };
        });

        setStudents(studentsList);
        setGrades(initialGrades);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching data:', err);
          setError(err.message);
        }
      } finally {
        // Only stop loading if this is the latest request
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [selectedClass, selectedStream, selectedSubject, selectedTerm, selectedYear, selectedSet, reloadKey]);

  const handleGradeChange = (student_id: string, field: string, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value);
    if (numValue !== undefined && (numValue < 0 || numValue > 100)) return;

    setHasEdits(true);
    setGrades(prev => prev.map(g => 
      g.student_id === student_id ? { ...g, [field]: numValue } : g
    ));
  };

  const calculateFinalScore = (grade: GradeEntry) => {
    const motPapers = [grade.mot_p1, grade.mot_p2, grade.mot_p3, grade.mot_p4].filter((p): p is number => p !== undefined && p !== null);
    const eotPapers = [grade.eot_p1, grade.eot_p2, grade.eot_p3, grade.eot_p4].filter((p): p is number => p !== undefined && p !== null);
    
    let motScore = 0;
    if (motPapers.length > 0) {
      motScore = Math.round(motPapers.reduce((a, b) => a + b, 0) / motPapers.length);
    }
    
    let eotScore = 0;
    if (eotPapers.length > 0) {
      eotScore = Math.round(eotPapers.reduce((a, b) => a + b, 0) / eotPapers.length);
    }

    return Math.round((motScore * 0.4) + (eotScore * 0.6));
  };

  const getGrade = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const getDescriptor = (grade: string) => {
    switch (grade) {
      case 'A': return 'Excellent';
      case 'B': return 'Good';
      case 'C': return 'Average';
      case 'D': return 'Below Average';
      case 'F': return 'Fail';
      default: return '';
    }
  };

  const handleSave = async () => {
    if (!selectedClass || !selectedStream || !selectedSubject) {
      alert('Please select class, stream and subject first');
      return;
    }

    try {
      setSaving(true);
      
      const gradesData = grades.map(g => {
        const motPapers = [g.mot_p1, g.mot_p2, g.mot_p3, g.mot_p4].filter((p): p is number => p !== undefined && p !== null);
        const motScore = motPapers.length > 0 
          ? Math.round(motPapers.reduce((a, b) => a + b, 0) / motPapers.length)
          : undefined;
        
        const eotPapers = [g.eot_p1, g.eot_p2, g.eot_p3, g.eot_p4].filter((p): p is number => p !== undefined && p !== null);
        const eotScore = eotPapers.length > 0
          ? Math.round(eotPapers.reduce((a, b) => a + b, 0) / eotPapers.length)
          : undefined;

        // Send only the fields that are actually present to avoid errors
        const gradeData: any = {
          student_id: g.student_id,
          class_id: selectedClass,
          stream_id: selectedStream,
          subject_id: selectedSubject,
          term: selectedTerm,
          academic_year: selectedYear
        };
        
        if (motScore !== undefined) gradeData.mot_score = motScore;
        if (eotScore !== undefined) gradeData.eot_score = eotScore;
        if (g.mot_p1 !== undefined && g.mot_p1 !== null) gradeData.mot_p1 = g.mot_p1;
        if (g.eot_p1 !== undefined && g.eot_p1 !== null) gradeData.eot_p1 = g.eot_p1;
        if (g.mot_p2 !== undefined && g.mot_p2 !== null) gradeData.mot_p2 = g.mot_p2;
        if (g.eot_p2 !== undefined && g.eot_p2 !== null) gradeData.eot_p2 = g.eot_p2;
        if (g.mot_p3 !== undefined && g.mot_p3 !== null) gradeData.mot_p3 = g.mot_p3;
        if (g.eot_p3 !== undefined && g.eot_p3 !== null) gradeData.eot_p3 = g.eot_p3;
        if (g.mot_p4 !== undefined && g.mot_p4 !== null) gradeData.mot_p4 = g.mot_p4;
        if (g.eot_p4 !== undefined && g.eot_p4 !== null) gradeData.eot_p4 = g.eot_p4;
        
        return gradeData;
      }).filter(g => Object.keys(g).length > 6);

      if (gradesData.length === 0) {
        alert('No grades to save. Please enter marks first.');
        return;
      }

      if (isPublished) {
        alert('Cannot save grades: this term has already been published and editing is locked.');
        return;
      }

      const res = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gradesData)
      });

      if (!res.ok) {
        let errorText = `Failed to save grades (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) {
            errorText = body.error;
          }
        } catch (jsonErr) {
          console.error('Failed to parse error response from grades API:', jsonErr);
        }
        throw new Error(errorText);
      }

      // After successful save, immediately refetch students and grades for this selection
      // to ensure MOT/EOT rows persisted and are displayed (prevents perceived disappearance).
      const params = new URLSearchParams();
      params.append('class_id', selectedClass);
      params.append('stream_id', selectedStream);
      params.append('subject_id', selectedSubject);
      params.append('term', selectedTerm);
      params.append('academic_year', selectedYear);

      try {
        const [studentsRes, gradesRes] = await Promise.all([
          fetch(`/api/students?${params.toString()}`, { cache: 'no-store' }),
          fetch(`/api/grades?${params.toString()}`, { cache: 'no-store' })
        ]);
        if (studentsRes.ok && gradesRes.ok) {
          const [studentsData, gradesDataResp] = await Promise.all([studentsRes.json(), gradesRes.json()]);
          const studentsList = studentsData.data || [];
          const gradesList = gradesDataResp.data || [];

          // Rebuild local grades state consistent with initial loading logic
          const refreshedGrades: GradeEntry[] = studentsList.map((s: Student) => {
            const existingGrade = gradesList.find((g: any) => String(g.student_id) === String(s.id));
            const paperScores: Record<number, { mot?: number; eot?: number }> = {};
            if (existingGrade?.grade_papers && Array.isArray(existingGrade.grade_papers)) {
              for (const paper of existingGrade.grade_papers) {
                if (!paperScores[paper.paper_number]) paperScores[paper.paper_number] = {};
                const atype = (paper.assessment_type || '').toString().toUpperCase();
                const scoreNum = paper.score !== undefined && paper.score !== null ? Number(paper.score) : undefined;
                if (atype === 'EOT') paperScores[paper.paper_number].eot = scoreNum;
                else paperScores[paper.paper_number].mot = scoreNum;
              }
            }

            const hasSinglePaper = paperCount === 1;
            const motP1 = existingGrade?.p1_score ?? paperScores[1]?.mot;
            const eotP1 = existingGrade?.p1_eot_score ?? paperScores[1]?.eot;

            return {
              student_id: s.id,
              mot_p1: motP1 !== undefined ? motP1 : (hasSinglePaper ? existingGrade?.mot_score : undefined),
              mot_p2: existingGrade?.p2_score ?? paperScores[2]?.mot ?? undefined,
              mot_p3: existingGrade?.p3_score ?? paperScores[3]?.mot ?? undefined,
              mot_p4: existingGrade?.p4_score ?? paperScores[4]?.mot ?? undefined,
              eot_p1: eotP1 !== undefined ? eotP1 : (hasSinglePaper ? existingGrade?.eot_score : undefined),
              eot_p2: existingGrade?.p2_eot_score ?? paperScores[2]?.eot ?? undefined,
              eot_p3: existingGrade?.p3_eot_score ?? paperScores[3]?.eot ?? undefined,
              eot_p4: existingGrade?.p4_eot_score ?? paperScores[4]?.eot ?? undefined
            };
          });

          setStudents(studentsList);
          setGrades(refreshedGrades);
        } else {
          // fallback: trigger reloadKey so existing effect refetches
          setReloadKey(k => k + 1);
        }
      } catch (refetchErr) {
        console.error('Refetch after save failed:', refetchErr);
        setReloadKey(k => k + 1);
      }

      setHasEdits(false);
      alert('Grades saved successfully!');
    } catch (error: any) {
      console.error('Error saving grades:', error);
      alert('Failed to save grades: ' + error.message);
    } finally {
      setSaving(false);
      setHasEdits(false); // Reset even on failure if we want to follow user's "blur" request strictly, but usually better only on success.
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const Sidebar = SidebarComponent || TeacherSidebar;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Fixed Position */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content - Scrollable */}
      <div className={`flex-1 pt-16 lg:pt-0 min-h-screen transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="text-red-600 text-lg mb-2">Error: {error}</div>
              <button 
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          )}

          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Marks Entry</h1>
            <p className="text-gray-600 mt-2">Enter assessment scores for your students</p>
          </div>

          {/* Filters */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                >
                  <option value="">Select Class</option>
                  {classes.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stream</label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  disabled={!selectedClass}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                >
                  <option value="">Select Stream</option>
                  {streams.map((stream: any) => (
                    <option key={stream.id} value={stream.id}>{stream.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  disabled={!selectedStream}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SET</label>
                <select
                  value={selectedSet}
                  onChange={(e) => setSelectedSet(e.target.value as 'MOT' | 'EOT')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                >
                  <option value="MOT">MOT</option>
                  <option value="EOT">EOT</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                >
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              {isPublished && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  This term has been published for the selected class and stream. Grade entry is locked.
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !selectedClass || !selectedStream || !selectedSubject || !hasEdits || isPublished}
                className={`px-6 py-2 rounded-md transition-all duration-200 ${
                  saving || !selectedClass || !selectedStream || !selectedSubject || !hasEdits || isPublished
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-100'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                }`}
              >
                {saving ? 'Saving...' : 'Save Grades'}
              </button>
            </div>
          </div>

          {/* Students Table */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
              <span className="ml-2">Loading students...</span>
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">P1</th>
                    {paperCount >= 2 && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">P2</th>
                    )}
                    {paperCount >= 3 && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">P3</th>
                    )}
                    {paperCount >= 4 && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P4</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => {
                    const grade = grades.find(g => g.student_id === student.id);
                    const prefix = selectedSet === 'MOT' ? 'mot' : 'eot';
                    
                    return (
                      <tr key={student.id} className="border-b border-gray-200">
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                          <div className="text-sm text-gray-500">{student.schoolpay_code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={grade?.[`${prefix}_p1`] ?? ''}
                            onChange={(e) => handleGradeChange(student.id, `${prefix}_p1`, e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1"
                          />
                        </td>
                        {paperCount >= 2 && (
                          <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={grade?.[`${prefix}_p2`] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, `${prefix}_p2`, e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1"
                            />
                          </td>
                        )}
                        {paperCount >= 3 && (
                          <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={grade?.[`${prefix}_p3`] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, `${prefix}_p3`, e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1"
                            />
                          </td>
                        )}
                        {paperCount >= 4 && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={grade?.[`${prefix}_p4`] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, `${prefix}_p4`, e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1"
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : selectedClass && selectedStream && selectedSubject ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No students found for this selection</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Please select class, stream, and subject to view students</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
