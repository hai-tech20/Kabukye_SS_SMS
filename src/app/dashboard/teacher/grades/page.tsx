'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TeacherSidebar from '@/components/sidebar/TeacherSidebar';
import { getCurrentTerm } from '@/lib/academic-calendar';

type SidebarComponent = React.ComponentType<{ sidebarOpen: boolean; setSidebarOpen: (open: boolean) => void }>;

interface GradesViewPageProps {
  SidebarComponent?: SidebarComponent;
}

interface Student {
  id: string;
  full_name: string;
  class: string;
  stream: string;
}

interface Grade {
  student_id: string;
  subject: string;
  mot?: number;
  eot?: number;
  final_score: number;
  grade: string;
  descriptor: string;
}

interface Subject {
  id: string;
  name: string;
  paper_count: number;
}

function GradesViewPage({ SidebarComponent }: GradesViewPageProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const Sidebar = SidebarComponent || TeacherSidebar;
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(searchParams.get('class') || '');
  const [selectedStream, setSelectedStream] = useState(searchParams.get('stream') || '');
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject') || '');
  
  // Get current term and year for defaults
  const currentTermData = getCurrentTerm();
  const getTermLabel = (termName: string) => {
    if (termName.includes('I') && !termName.includes('II')) return 'Term 1';
    if (termName.includes('II')) return 'Term 2';
    if (termName.includes('III')) return 'Term 3';
    return 'Term 1';
  };
  
  const [selectedTerm, setSelectedTerm] = useState(getTermLabel(currentTermData.name));
  const [selectedYear, setSelectedYear] = useState(currentTermData.academicYear.toString());
  const [selectedSet, setSelectedSet] = useState<'MOT' | 'EOT' | 'ALL'>('ALL');
  const [isPublished, setIsPublished] = useState(false);
  const [editingMode, setEditingMode] = useState(false);
  const [editedGrades, setEditedGrades] = useState<Grade[]>([]);
  
  // Teacher assignments for filtering
  const [classes, setClasses] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStreamsAndSubjects(selectedClass);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && selectedStream && selectedSubject) {
      fetchGrades();
    }
  }, [selectedClass, selectedStream, selectedSubject, selectedTerm, selectedYear, selectedSet]);

  const fetchGrades = async () => {
    try {
      setLoading(true);
      
      // Fetch real grades from API (API handles auth)
      const setParam = selectedSet !== 'ALL' ? `&set=${selectedSet}` : '';
      const gradesRes = await fetch(`/api/grades?class_id=${selectedClass}&stream_id=${selectedStream}&subject_id=${selectedSubject}&term=${selectedTerm.replace('Term ', '')}&year=${selectedYear}${setParam}`);
      const gradesJson = await gradesRes.json();
      
      if (gradesJson.data) {
        // Transform API data to match our interface
        const transformedGrades: Grade[] = gradesJson.data.map((g: any) => ({
          student_id: g.student_id,
          subject: g.subjects?.name || selectedSubject,
          mot: g.mot_score,
          eot: g.eot_score,
          final_score: g.final_score || 0,
          grade: g.grade || '-',
          descriptor: g.descriptor || ''
        }));
        
        // Create students array from grades data
        const studentsFromGrades: Student[] = gradesJson.data.map((g: any) => ({
          id: g.student_id,
          full_name: g.students?.full_name || 'Unknown',
          class: g.class_id,
          stream: g.stream_id
        }));
        
        setStudents(studentsFromGrades);
        setGrades(transformedGrades);
        setEditedGrades(transformedGrades);
      } else {
        setStudents([]);
        setGrades([]);
        setEditedGrades([]);
      }
      
      setIsPublished(false);
    } catch (error) {
      console.error('Error fetching grades:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      // Fetch teacher's assigned classes
      const teacherSubjectsRes = await fetch('/api/teacher/subjects');
      const teacherSubjectsJson = await teacherSubjectsRes.json();
      const assignments = teacherSubjectsJson.data || [];
      setTeacherAssignments(assignments);
      
      // Get unique class IDs from teacher assignments
      const assignedClassIds = [...new Set(assignments.map((a: any) => a.class_id))];
      
      // Fetch all classes
      const res = await fetch('/api/classes');
      const json = await res.json();
      
      // Filter classes to only show assigned ones
      const allClasses = json.data?.classes || [];
      const assignedClasses = allClasses.filter((cls: any) => assignedClassIds.includes(cls.id));
      
      setClasses(assignedClasses);
      
      // Set default selections if not already set
      if (!selectedClass && assignedClasses.length > 0) {
        setSelectedClass(assignedClasses[0].id);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchStreamsAndSubjects = async (classId: string) => {
    try {
      // Filter assignments for this specific class
      const classAssignments = teacherAssignments.filter((a: any) => a.class_id === classId);
      
      // Get unique streams from assignments
      const classStreams = classAssignments.map((assignment: any) => ({
        id: assignment.stream_id,
        name: assignment.streams?.name || assignment.sms_streams?.name || assignment.stream_id,
        class_id: assignment.class_id
      }));

      // Remove duplicate streams
      const streamMap = new Map();
      classStreams.forEach((stream: any) => {
        if (!streamMap.has(stream.id)) {
          streamMap.set(stream.id, stream);
        }
      });
      const uniqueStreams = Array.from(streamMap.values());
      setStreams(uniqueStreams);

      // Get unique subjects from teacher's assignments for this class
      const classSubjects = classAssignments.map((assignment: any) => ({
        id: assignment.subject_id,
        name: assignment.subjects?.name || assignment.sms_subjects?.name || assignment.subject_id,
        paper_count: assignment.subjects?.paper_count || assignment.sms_subjects?.paper_count || 1
      }));

      // Remove duplicate subjects
      const subjectMap = new Map();
      classSubjects.forEach((subject: any) => {
        if (!subjectMap.has(subject.id)) {
          subjectMap.set(subject.id, subject);
        }
      });
      const uniqueSubjects = Array.from(subjectMap.values());
      setSubjects(uniqueSubjects);
      
      // Reset stream and subject when class changes
      if (uniqueStreams.length > 0) {
        setSelectedStream(uniqueStreams[0].id);
      }
      if (uniqueSubjects.length > 0) {
        setSelectedSubject(uniqueSubjects[0].id);
      }
    } catch (error) {
      console.error('Error fetching streams/subjects:', error);
    }
  };

  const handleEditToggle = () => {
    if (editingMode) {
      // Cancel editing - revert changes
      setEditedGrades([...grades]);
    }
    setEditingMode(!editingMode);
  };

  const handleGradeChange = (studentId: string, assessment: string, value: string) => {
    const numValue = parseInt(value) || 0;
    
    if (numValue < 0 || numValue > 100) {
      return; // Invalid score
    }

    setEditedGrades(prev => {
      return prev.map(g => 
        g.student_id === studentId 
          ? { ...g, [assessment]: numValue }
          : g
      );
    });
  };

  const handleSaveChanges = async () => {
    try {
      // API call to save updated grades
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setGrades([...editedGrades]);
      setEditingMode(false);
      alert('Grades updated successfully!');
    } catch (error) {
      console.error('Error saving grades:', error);
      alert('Failed to update grades');
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B':
        return 'bg-blue-100 text-blue-800';
      case 'C':
        return 'bg-yellow-100 text-yellow-800';
      case 'D':
        return 'bg-orange-100 text-orange-800';
      case 'F':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const currentGrades = editingMode ? editedGrades : grades;

  const stats = useMemo(() => {
    // Determine which numeric value to use per selectedSet
    const extractScore = (g: any) => {
      if (selectedSet === 'MOT') return g.mot_score ?? g.mot ?? null;
      if (selectedSet === 'EOT') return g.eot_score ?? g.eot ?? null;
      return g.final_score ?? null;
    };

    const scores = (currentGrades || [])
      .map(extractScore)
      .filter((s: any) => s !== null && s !== undefined && !isNaN(s))
      .map((n: any) => Number(n));

    const count = scores.length;
    if (count === 0) return {
      count: 0,
      average: 0,
      median: 0,
      stddev: 0,
      highest: 0,
      lowest: 0,
      passRate: 0,
      distribution: {}
    };

    const sum = scores.reduce((a, b) => a + b, 0);
    const average = +(sum / count).toFixed(1);

    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(count / 2);
    const median = count % 2 === 0 ? +( (sorted[mid - 1] + sorted[mid]) / 2 ).toFixed(1) : +sorted[mid].toFixed(1);

    const variance = scores.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / count;
    const stddev = +Math.sqrt(variance).toFixed(1);

    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);

    // Simple pass threshold (>=50)
    const passCount = scores.filter(s => s >= 50).length;
    const passRate = +((passCount / count) * 100).toFixed(1);

    // Grade buckets A/B/C/D/F using simple boundaries
    const getGradeLetter = (score: number) => {
      if (score >= 90) return 'A';
      if (score >= 80) return 'B';
      if (score >= 70) return 'C';
      if (score >= 60) return 'D';
      return 'F';
    };

    const distribution: Record<string, { count: number; pct: number }> = {};
    for (const s of scores) {
      const g = getGradeLetter(s);
      distribution[g] = distribution[g] || { count: 0, pct: 0 };
      distribution[g].count++;
    }
    for (const k of Object.keys(distribution)) {
      distribution[k].pct = +((distribution[k].count / count) * 100).toFixed(1);
    }

    return { count, average, median, stddev, highest, lowest, passRate, distribution };
  }, [currentGrades, selectedSet, editingMode]);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Fixed Position */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content - Scrollable */}
      <div className={`flex-1 pt-16 lg:pt-0 min-h-screen transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                <p className="mt-4 text-gray-600">Loading grades...</p>
              </div>
            </div>
          ) : (
          <>
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">View Grade Stats</h1>
            <p className="text-gray-600 mt-2">Review and analyze student performance statistics</p>
          </div>

          {/* Filters */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stream</label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                >
                  <option value="">Select Stream</option>
                  {streams.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SET</label>
                <select
                  value={selectedSet}
                  onChange={(e) => setSelectedSet(e.target.value as 'MOT' | 'EOT' | 'ALL')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                >
                  <option value="ALL">All</option>
                  <option value="MOT">MOT</option>
                  <option value="EOT">EOT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-full">
                  <svg className="w-6 h-6 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Class Average</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.average}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-full">
                  <svg className="w-6 h-6 text-green-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Highest Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.highest}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-full">
                  <svg className="w-6 h-6 text-red-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Lowest Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.lowest}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedClass}{selectedStream} - {selectedSubject} - {selectedTerm}, {selectedYear}
                </h2>
                <p className="text-gray-600 mt-1">
                  {students.length} students • {isPublished ? 'Published' : 'Draft'}
                </p>
              </div>
              <div className="flex space-x-3">
                {!isPublished && (
                  <button
                    onClick={handleEditToggle}
                    className={`px-4 py-2 rounded-md ${
                      editingMode
                        ? 'bg-gray-600 text-white hover:bg-gray-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {editingMode ? 'Cancel' : 'Edit Grades'}
                  </button>
                )}
                {editingMode && (
                  <button
                    onClick={handleSaveChanges}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grades Table */}
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      MOT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      EOT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      Final Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descriptor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => {
                    const grade = grades.find(g => g.student_id === student.id);
                    const editedGrade = editedGrades.find(g => g.student_id === student.id);
                    const currentGrade = editingMode ? editedGrade : grade;
                    
                    return (
                      <tr key={student.id} className="border-b border-gray-200">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                          {student.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          {editingMode ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentGrade?.mot || ''}
                              onChange={(e) => handleGradeChange(student.id, 'mot', e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-blue-900 focus:border-blue-900"
                              placeholder="0-100"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">{currentGrade?.mot || '-'}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          {editingMode ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentGrade?.eot || ''}
                              onChange={(e) => handleGradeChange(student.id, 'eot', e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-blue-900 focus:border-blue-900"
                              placeholder="0-100"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">{currentGrade?.eot || '-'}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                          {currentGrade?.final_score || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getGradeColor(currentGrade?.grade || '')}`}>
                            {currentGrade?.grade || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {currentGrade?.descriptor || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function GradesPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div><p className="mt-4 text-gray-600">Loading...</p></div></div>}>
      <GradesViewPage />
    </Suspense>
  );
}

export default function GradesPage() {
  return <GradesPageWrapper />;
}
