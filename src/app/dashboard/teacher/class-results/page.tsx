'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TeacherSidebar from '@/components/sidebar/TeacherSidebar';

interface Teacher {
  id: string;
  full_name: string;
  is_class_teacher: boolean;
  class_teacher_class_id?: string;
  class_teacher_stream_id?: string;
}

interface Student {
  id: string;
  full_name: string;
  schoolpay_code?: string;
  subject_combination?: string;
  class_id?: string;
}

interface Subject {
  id: string;
  name: string;
  paper_count: number;
  abbreviated_name: string;
}

interface Grade {
  student_id: string;
  subject_id: string;
  mot_score?: number;
  eot_score?: number;
  final_score?: number;
  grade?: string;
  p1_score?: number;
  p2_score?: number;
  p3_score?: number;
}

// Subject abbreviation mapping
const subjectAbbreviations: { [key: string]: string } = {
  'Mathematics': 'Math',
  'English Language': 'Eng',
  'Chemistry': 'Chem',
  'Biology': 'Bio',
  'Physics': 'Phy',
  'History': 'Hist',
  'History & Political Education': 'Hist',
  'Geography': 'Geog',
  'CRE': 'CRE',
  'IRE': 'IRE',
  'Kiswahili': 'Kisw',
  'Literature in English': 'Lit',
  'Agriculture': 'Agric',
  'Entrepreneurship': 'Ent',
  'Fine Art': 'Art',
  'Computer Studies': 'Comp',
  'Lusoga': 'Lus',
  'General Paper': 'GP',
  'Divinity': 'Div',
  'Islam': 'Isl',
  'Sub ICT': 'ICT',
  'Sub Mathematics': 'Sub Math',
  'Economics': 'Econ'
};

export default function ClassResultsPage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classInfo, setClassInfo] = useState<{ name: string; stream_name: string } | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedSet, setSelectedSet] = useState<'MOT' | 'EOT'>('MOT');

  useEffect(() => {
    fetchTeacherData();
  }, []);

  useEffect(() => {
    if (teacher?.is_class_teacher && teacher.class_teacher_class_id) {
      fetchGrades(
        teacher.class_teacher_class_id,
        teacher.class_teacher_stream_id,
        selectedYear,
        selectedTerm,
        selectedSet
      );
    }
  }, [teacher, selectedYear, selectedTerm, selectedSet]);

  const fetchTeacherData = async () => {
    try {
      const sessionResponse = await fetch('/api/auth/me');
      if (!sessionResponse.ok) {
        window.location.href = '/login/teacher';
        return;
      }
      const session = await sessionResponse.json();
      const teacherId = session.id;
      
      const teacherResponse = await fetch(`/api/teachers/${teacherId}`);
      if (teacherResponse.ok) {
        const { data } = await teacherResponse.json();
        setTeacher(data);
        
        // If class teacher, fetch class info and student list
        if (data?.is_class_teacher && data?.class_teacher_class_id) {
          fetchClassData(data.class_teacher_class_id, data.class_teacher_stream_id);
        }
      } else {
        console.error('Failed to fetch teacher info:', teacherResponse.status);
      }
    } catch (error) {
      console.error('Error fetching teacher data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassData = async (classId: string, streamId?: string) => {
    try {
      setDataLoading(true);
      
      // Fetch class info
      const classesRes = await fetch('/api/classes');
      if (classesRes.ok) {
        const classesData = await classesRes.json();
        const classItem = classesData.data?.classes?.find((c: any) => c.id === classId);
        const streamItem = classesData.data?.streams?.find((s: any) => s.id === streamId);
        setClassInfo({
          name: classItem?.name || classId,
          stream_name: streamItem?.name || ''
        });
      }
      
      // Fetch students for this class/stream
      let studentsUrl = `/api/students?class_id=${classId}`;
      if (streamId) studentsUrl += `&stream_id=${streamId}`;
      const studentsRes = await fetch(studentsUrl);
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(studentsData.data || []);
      }
      
      // Fetch subjects for this class
      const subjectsRes = await fetch(`/api/subjects?class_id=${classId}`);
      let allSubjects: any[] = [];
      if (subjectsRes.ok) {
        const subjectsData = await subjectsRes.json();
        const subjectsArray = Array.isArray(subjectsData) ? subjectsData : (subjectsData.data || []);
        allSubjects = [...subjectsArray];
      }
      
      setSubjects([]);
      if (allSubjects.length > 0) {
        const mappedSubjects = allSubjects.map((s: any) => ({
          id: s.id,
          name: s.name,
          paper_count: s.paper_count || 1,
          abbreviated_name: subjectAbbreviations[s.name] || s.name.substring(0, 4)
        }));
        setSubjects(mappedSubjects);
      }
    } catch (error) {
      console.error('Error fetching class data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchGrades = async (classId: string, streamId: string | undefined, year: string, term: string, setType: 'MOT' | 'EOT') => {
    try {
      setDataLoading(true);
      const gradesRes = await fetch(
        `/api/grades?class_id=${classId}${streamId ? `&stream_id=${streamId}` : ''}&year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&set=${encodeURIComponent(setType)}`
      );
      console.log('Class Results - Grades fetch status:', gradesRes.status, 'set:', setType);
      if (!gradesRes.ok) {
        console.error('Failed to fetch grades:', gradesRes.status);
        setGrades([]);
        return;
      }

      const gradesData = await gradesRes.json();
      const transformedGrades = (gradesData.data || []).map((grade: any) => {
        const papers = grade.grade_papers || [];
        return {
          ...grade,
          p1_score: papers.find((p: any) => p.paper_number === 1)?.score,
          p2_score: papers.find((p: any) => p.paper_number === 2)?.score,
          p3_score: papers.find((p: any) => p.paper_number === 3)?.score,
        };
      });
      setGrades(transformedGrades);

      const gradeSubjectIds = [...new Set(transformedGrades.map((g: any) => g.subject_id))];
      const existingSubjectIds = subjects.map(s => s.id);
      const missingSubjectIds = gradeSubjectIds.filter(id => !existingSubjectIds.includes(id));

      if (missingSubjectIds.length > 0) {
        const allSubjectsRes = await fetch('/api/subjects');
        if (allSubjectsRes.ok) {
          const allSubjectsData = await allSubjectsRes.json();
          const allSubjectsArray = Array.isArray(allSubjectsData) ? allSubjectsData : (allSubjectsData.data || []);
          const missingSubjects = allSubjectsArray.filter((s: any) => missingSubjectIds.includes(s.id));

          if (missingSubjects.length > 0) {
            setSubjects(prevSubjects => {
              const merged = [...prevSubjects];
              for (const subject of missingSubjects) {
                if (!merged.some(s => s.id === subject.id)) {
                  merged.push({
                    id: subject.id,
                    name: subject.name,
                    paper_count: subject.paper_count || 1,
                    abbreviated_name: subjectAbbreviations[subject.name] || subject.name.substring(0, 4)
                  });
                }
              }
              return merged;
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching grades:', error);
      setGrades([]);
    } finally {
      setDataLoading(false);
    }
  };

  const getStudentGrades = (studentId: string, subjectId: string) => {
    return grades.find(g => g.student_id === studentId && g.subject_id === subjectId);
  };

  const getGradeDisplay = (grade: Grade | undefined, paperNum: number) => {
    if (!grade) return '-';
    if (paperNum === 1) {
      if (selectedSet === 'MOT' && grade.mot_score !== undefined && grade.mot_score !== null) {
        return grade.mot_score;
      }
      if (selectedSet === 'EOT' && grade.eot_score !== undefined && grade.eot_score !== null) {
        return grade.eot_score;
      }
      if (grade.p1_score !== undefined && grade.p1_score !== null) {
        return grade.p1_score;
      }
      if (grade.final_score !== undefined && grade.final_score !== null) {
        return grade.final_score;
      }
      return '-';
    }

    if (paperNum === 2 && grade.p2_score !== undefined && grade.p2_score !== null) return grade.p2_score;
    if (paperNum === 3 && grade.p3_score !== undefined && grade.p3_score !== null) return grade.p3_score;
    return '-';
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = '/api/auth/logout';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900"></div>
          <p className="mt-4 text-gray-600">Loading class results...</p>
        </div>
      </div>
    );
  }

  if (!teacher?.is_class_teacher) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">You are not assigned as a class teacher.</p>
          <Link href="/dashboard/teacher" className="mt-4 text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isALevelClass = students.some(s => s.class_id?.toLowerCase().includes('s5') || s.class_id?.toLowerCase().includes('s6'));
  const totalColumns = subjects.reduce((acc, s) => acc + s.paper_count, 0) + 2 + (isALevelClass ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Fixed Position */}
      <TeacherSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content - Scrollable */}
      <div className={`flex-1 pt-16 lg:pt-0 min-h-screen transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                <p className="mt-4 text-gray-600">Loading class results...</p>
              </div>
            </div>
          ) : (
          <>
          <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Class Results</h1>
              <p className="text-gray-600 mt-2">
                {classInfo ? `${classInfo.name} ${classInfo.stream_name} - Class Teacher: ${teacher?.full_name}` : 'Loading...'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{teacher?.full_name}</span>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Academic Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Set</label>
              <select
                value={selectedSet}
                onChange={(e) => setSelectedSet(e.target.value as 'MOT' | 'EOT')}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="MOT">MOT</option>
                <option value="EOT">EOT</option>
              </select>
            </div>
            <div className="rounded-lg border border-gray-200 bg-blue-50 p-4 text-sm text-blue-900">
              Viewing {selectedSet} results for term {selectedTerm}, {selectedYear}
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white shadow-md rounded-lg overflow-hidden mb-6">
            {dataLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-900"></div>
                <p className="mt-2 text-gray-600">Loading results...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border-collapse">
                  <thead className="bg-gray-50">
                    {/* Subject Headers Row */}
                    <tr>
                      <th rowSpan={2} className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300 w-8">
                        No.
                      </th>
                      <th rowSpan={2} className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300 w-32">
                        Name
                      </th>
                      {isALevelClass && (
                        <th rowSpan={2} className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300 w-20">
                          Comb
                        </th>
                      )}
                      {subjects.map((subject) => (
                        <th 
                          key={subject.id}
                          colSpan={subject.paper_count}
                          className="px-1 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300 bg-blue-50"
                        >
                          {subject.abbreviated_name}
                        </th>
                      ))}
                    </tr>
                    {/* Paper Headers Row */}
                    <tr>
                      {subjects.map((subject) => (
                        Array.from({ length: subject.paper_count }).map((_, i) => (
                          <th 
                            key={`${subject.id}-p${i + 1}`}
                            className="px-1 py-1 text-center text-[10px] font-bold text-gray-600 uppercase tracking-wider border border-gray-300 bg-gray-100 w-10"
                          >
                            P{i + 1}
                          </th>
                        ))
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student, index) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1 text-xs font-medium text-gray-900 border border-gray-300 text-center">
                          {index + 1}
                        </td>
                        <td className="px-3 py-1 text-xs font-medium text-gray-900 border border-gray-300 truncate">
                          {student.full_name}
                        </td>
                        {isALevelClass && (
                          <td className="px-2 py-1 text-xs font-medium text-gray-700 border border-gray-300 text-center">
                            {student.subject_combination || '-'}
                          </td>
                        )}
                        {subjects.map((subject) => {
                          const grade = getStudentGrades(student.id, subject.id);
                          if (index === 0) {
                            console.log(`Class Results - Student ${student.id}, Subject ${subject.id} (${subject.abbreviated_name}):`, grade);
                          }
                          return Array.from({ length: subject.paper_count }).map((_, i) => (
                            <td 
                              key={`${student.id}-${subject.id}-p${i + 1}`}
                              className="px-1 py-1 text-xs text-center text-gray-700 border border-gray-300 w-10"
                            >
                              {getGradeDisplay(grade, i + 1)}
                            </td>
                          ));
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {students.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No students found for this class.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white shadow-md rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Subject Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              {subjects.map((subject) => (
                <div key={subject.id} className="flex items-center space-x-2">
                  <span className="font-bold text-blue-900">{subject.abbreviated_name}:</span>
                  <span className="text-gray-600">{subject.name}</span>
                  {subject.paper_count > 1 && (
                    <span className="text-gray-400">({subject.paper_count} papers)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
