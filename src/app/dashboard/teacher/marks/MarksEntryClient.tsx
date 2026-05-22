'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TeacherSidebar from '@/components/sidebar/TeacherSidebar';

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
  eot_p1?: number;
  eot_p2?: number;
  eot_p3?: number;
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

interface MarksEntryClientProps {
  initialAssignments: Assignment[];
  initialClasses: any[];
  initialStreams: any[];
  initialSubjects: any[];
  teacherId: string;
  error: string | null;
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
  
  // Pre-filtered data based on teacher assignments
  const [classes] = useState(() => {
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
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedYear, setSelectedYear] = useState('2026');
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
  useEffect(() => {
    if (initialAssignments.length === 0) {
      setError('No subjects assigned to you. Please contact the administrator.');
    }
  }, [initialAssignments]);

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

  // Fetch streams and subjects when class changes
  useEffect(() => {
    if (!selectedClass) {
      setStreams([]);
      setSubjects([]);
      return;
    }

    // Filter streams and subjects based on assignments for selected class
    const relevantAssignments = initialAssignments.filter(a => a.class_id === selectedClass);
    
    const relevantStreamIds = [...new Set(relevantAssignments.map(a => a.stream_id))];
    const relevantSubjectIds = [...new Set(relevantAssignments.map(a => a.subject_id))];
    
    const filteredStreams = allStreams.filter((s: any) => relevantStreamIds.includes(s.id));
    const filteredSubjects = allSubjects.filter((s: any) => relevantSubjectIds.includes(s.id));
    
    setStreams(filteredStreams);
    setSubjects(filteredSubjects);
    setSelectedSubject('');
  }, [selectedClass, initialAssignments, allStreams, allSubjects]);

  // Fetch students and grades with deduplication
  useEffect(() => {
    if (!selectedClass || !selectedStream || !selectedSubject) return;
    
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    isFetchingRef.current = true;
    setLoading(true);
    
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        params.append('class_id', selectedClass);
        params.append('stream_id', selectedStream);
        params.append('subject_id', selectedSubject);
        params.append('term', selectedTerm);
        params.append('academic_year', selectedYear);
        params.append('t', Date.now().toString());
        
        // Fetch students
        const studentsRes = await fetch(`/api/students?${params.toString()}`, {
          signal: abortControllerRef.current?.signal,
          cache: 'no-store'
        });
        if (!studentsRes.ok) throw new Error('Failed to fetch students');
        const studentsData = await studentsRes.json();
        
        // Fetch grades
        const gradesRes = await fetch(`/api/grades?${params.toString()}`, {
          signal: abortControllerRef.current?.signal,
          cache: 'no-store'
        });
        if (!gradesRes.ok) throw new Error('Failed to fetch grades');
        const gradesData = await gradesRes.json();
        
        const studentsList = studentsData.data || [];
        const gradesList = gradesData.data || [];
        
        // Initialize grades from existing data or empty
        const initialGrades: GradeEntry[] = studentsList.map((s: Student) => {
          const existingGrade = gradesList.find((g: any) => g.student_id === s.id);
          
          // Extract paper scores from grade_papers array or from p1_score, p2_score, p3_score columns
          const paperScores: Record<number, { mot?: number; eot?: number }> = {};
          
          // First check grade_papers array
          if (existingGrade?.grade_papers && Array.isArray(existingGrade.grade_papers)) {
            for (const paper of existingGrade.grade_papers) {
              if (!paperScores[paper.paper_number]) {
                paperScores[paper.paper_number] = {};
              }
              // Determine if MOT or EOT based on some logic or store separately
              paperScores[paper.paper_number].mot = paper.score;
            }
          }
          
          // Also check direct columns p1_score, p2_score, p3_score (legacy support)
          const currentSet = selectedSet; // MOT or EOT
          
          return {
            student_id: s.id,
            // MOT papers - from p1_score, p2_score, p3_score when available
            mot_p1: existingGrade?.p1_score ?? paperScores[1]?.mot ?? undefined,
            mot_p2: existingGrade?.p2_score ?? paperScores[2]?.mot ?? undefined,
            mot_p3: existingGrade?.p3_score ?? paperScores[3]?.mot ?? undefined,
            // EOT papers - stored separately or calculated
            eot_p1: existingGrade?.p1_eot_score ?? paperScores[1]?.eot ?? undefined,
            eot_p2: existingGrade?.p2_eot_score ?? paperScores[2]?.eot ?? undefined,
            eot_p3: existingGrade?.p3_eot_score ?? paperScores[3]?.eot ?? undefined
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
        isFetchingRef.current = false;
        setLoading(false);
      }
    };
    
    fetchData();
    
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [selectedClass, selectedStream, selectedSubject, selectedTerm, selectedYear]);

  const handleGradeChange = (student_id: string, field: string, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value);
    if (numValue !== undefined && (numValue < 0 || numValue > 100)) return;

    setHasEdits(true);
    setGrades(prev => prev.map(g => 
      g.student_id === student_id ? { ...g, [field]: numValue } : g
    ));
  };

  const calculateFinalScore = (grade: GradeEntry) => {
    // Use only filled paper scores, don't assume all papers exist
    const motPapers = [grade.mot_p1, grade.mot_p2, grade.mot_p3].filter((p): p is number => p !== undefined && p !== null);
    const eotPapers = [grade.eot_p1, grade.eot_p2, grade.eot_p3].filter((p): p is number => p !== undefined && p !== null);
    
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
        const motPapers = [g.mot_p1, g.mot_p2, g.mot_p3].filter((p): p is number => p !== undefined && p !== null);
        const motScore = motPapers.length > 0 
          ? Math.round(motPapers.reduce((a, b) => a + b, 0) / motPapers.length)
          : undefined;
        
        const eotPapers = [g.eot_p1, g.eot_p2, g.eot_p3].filter((p): p is number => p !== undefined && p !== null);
        const eotScore = eotPapers.length > 0
          ? Math.round(eotPapers.reduce((a, b) => a + b, 0) / eotPapers.length)
          : undefined;

        return {
          student_id: g.student_id,
          class_id: selectedClass,
          stream_id: selectedStream,
          subject_id: selectedSubject,
          term: selectedTerm,
          academic_year: selectedYear,
          mot_score: motScore,
          eot_score: eotScore,
          p1_score: g.mot_p1 ?? g.eot_p1,
          p2_score: g.mot_p2 ?? g.eot_p2,
          p3_score: g.mot_p3 ?? g.eot_p3
        };
      }).filter(g => g.mot_score !== undefined || g.eot_score !== undefined);

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
        const body = await res.json();
        throw new Error(body?.error || 'Failed to save grades');
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Fixed Position */}
      <TeacherSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P1</th>
                    {paperCount >= 2 && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P2</th>
                    )}
                    {paperCount >= 3 && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P3</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => {
                    const grade = grades.find(g => g.student_id === student.id);
                    const prefix = selectedSet === 'MOT' ? 'mot' : 'eot';
                    
                    return (
                      <tr key={student.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                          <div className="text-sm text-gray-500">{student.schoolpay_code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                          <td className="px-6 py-4 whitespace-nowrap">
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
                          <td className="px-6 py-4 whitespace-nowrap">
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
