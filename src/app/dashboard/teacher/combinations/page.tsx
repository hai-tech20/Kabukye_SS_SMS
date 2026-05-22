'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TeacherSidebar from '@/components/sidebar/TeacherSidebar';

interface Teacher {
  id: string;
  full_name: string;
  is_class_teacher: boolean;
  class_teacher_class_id?: string;
}

interface Student {
  id: string;
  full_name: string;
  class_id?: string;
  subject_combination?: string;
  stream_id?: string;
  streams?: { name: string };
}

interface Combination {
  id: string;
  code: string;
  name: string;
}

interface SubjectOption {
  id: string;
  name: string;
  class_id: string;
  paper_count?: number;
  subject_type?: string;
}

interface StudentSubjectRecord {
  id: string;
  student_id: string;
  subject_id: string;
  subject_type: string;
  is_principal: boolean;
  is_active: boolean;
  subjects: { id: string; name: string; subject_type: string };
  students: { id: string; full_name: string; class_id: string; stream_id: string; subject_combination?: string };
}

interface StudentAssignmentDraft {
  combination_code: string;
  principal1: string;
  principal2: string;
  principal3: string;
  subsidiary: string;
}

const A_LEVEL_CLASSES = ['s5', 's6'];

export default function TeacherCombinationsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<StudentSubjectRecord[]>([]);
  const [draftAssignments, setDraftAssignments] = useState<Record<string, StudentAssignmentDraft>>({});
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const classId = teacher?.class_teacher_class_id?.toString().toUpperCase() || '';
  const normalizedClassId = teacher?.class_teacher_class_id?.toString().toLowerCase().trim() || '';

  const principalOptions = useMemo(
    () => subjects.filter(subject => subject.subject_type === 'principal'),
    [subjects]
  );

  const subsidiaryOptions = useMemo(
    () => subjects.filter(subject => subject.subject_type === 'subsidiary'),
    [subjects]
  );

  const fetchStudents = useCallback(async (classIdentifier: string) => {
    const response = await fetch(`/api/students?class_id=${classIdentifier}`);
    const result = await response.json();
    if (response.ok) {
      setStudents(result.data || []);
      return result.data || [];
    }
    throw new Error(result.error || 'Failed to fetch students');
  }, []);

  const fetchCombinations = useCallback(async () => {
    const response = await fetch('/api/subject-combinations');
    const result = await response.json();
    if (response.ok) {
      setCombinations(result.data || []);
      return result.data || [];
    }
    throw new Error(result.error || 'Failed to fetch combinations');
  }, []);

  const fetchSubjects = useCallback(async (classIdentifier: string) => {
    const response = await fetch(`/api/subjects?class_id=${classIdentifier}`);
    const result = await response.json();
    if (response.ok) {
      const output = Array.isArray(result) ? result : result.data || [];
      setSubjects(output);
      return output;
    }
    throw new Error(result.error || 'Failed to fetch subjects');
  }, []);

  const fetchStudentSubjects = useCallback(async (classIdentifier: string) => {
    const response = await fetch(`/api/student-subjects?class_id=${classIdentifier}`);
    const result = await response.json();
    if (response.ok) {
      setStudentSubjects(result.data || []);
      return result.data || [];
    }
    throw new Error(result.error || 'Failed to fetch student subjects');
  }, []);

  const buildDraftAssignments = useCallback((studentsList: Student[], studentSubjectsList: StudentSubjectRecord[]) => {
    const draftMap: Record<string, StudentAssignmentDraft> = {};

    studentsList.forEach((student) => {
      const assignments = studentSubjectsList.filter(record => record.student_id === student.id && record.is_active);
      const principals = assignments.filter(record => record.subject_type === 'principal').map(record => record.subject_id);
      const subsidiary = assignments.find(record => record.subject_type === 'subsidiary')?.subject_id || '';
      const combination_code = student.subject_combination || '';

      draftMap[student.id] = {
        combination_code,
        principal1: principals[0] || '',
        principal2: principals[1] || '',
        principal3: principals[2] || '',
        subsidiary
      };
    });

    setDraftAssignments(draftMap);
  }, []);

  const loadPageData = useCallback(async (classIdentifier: string) => {
    setErrorMessage(null);
    try {
      const [studentsData, combinationsData, subjectsData, studentSubjectsData] = await Promise.all([
        fetchStudents(classIdentifier),
        fetchCombinations(),
        fetchSubjects(classIdentifier),
        fetchStudentSubjects(classIdentifier)
      ]);

      buildDraftAssignments(studentsData, studentSubjectsData);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'Failed to load combination manager.');
    }
  }, [buildDraftAssignments, fetchCombinations, fetchStudentSubjects, fetchStudents, fetchSubjects]);

  const fetchTeacherData = useCallback(async () => {
    try {
      const sessionResponse = await fetch('/api/auth/me');
      if (!sessionResponse.ok) {
        window.location.href = '/login/teacher';
        return;
      }
      const session = await sessionResponse.json();
      const teacherResponse = await fetch(`/api/teachers/${session.id}`);
      if (!teacherResponse.ok) {
        setErrorMessage('Unable to load teacher data.');
        setLoading(false);
        return;
      }
      const { data } = await teacherResponse.json();
      setTeacher(data);
      const teacherClassId = data?.class_teacher_class_id?.toString().toLowerCase().trim() || '';
      if (!data?.is_class_teacher || !A_LEVEL_CLASSES.includes(teacherClassId)) {
        setErrorMessage('This page is only available for S5-S6 class teachers.');
        setLoading(false);
        return;
      }
      await loadPageData(teacherClassId);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'Failed to load combination manager.');
    } finally {
      setLoading(false);
    }
  }, [loadPageData]);

  useEffect(() => {
    fetchTeacherData();
  }, [fetchTeacherData]);

  const handleSaveAssignment = async (studentId: string) => {
    const assignment = draftAssignments[studentId];
    if (!assignment) return;
    if (!assignment.principal1 || !assignment.principal2 || !assignment.principal3 || !assignment.subsidiary) {
      alert('Please select three principal subjects and a subsidiary subject before saving.');
      return;
    }

    const generalPaper = subjects.find(subject => subject.name.toLowerCase().includes('general paper'));

    const subjectList = [
      { student_id: studentId, subject_id: assignment.principal1, subject_type: 'principal' },
      { student_id: studentId, subject_id: assignment.principal2, subject_type: 'principal' },
      { student_id: studentId, subject_id: assignment.principal3, subject_type: 'principal' },
      { student_id: studentId, subject_id: assignment.subsidiary, subject_type: 'subsidiary' }
    ];

    if (generalPaper) {
      subjectList.push({ student_id: studentId, subject_id: generalPaper.id, subject_type: 'compulsory' });
    }

    setIsSaving(prev => ({ ...prev, [studentId]: true }));
    try {
      const response = await fetch('/api/student-subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          subjects: subjectList,
          combination_code: assignment.combination_code || undefined
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save subject assignments.');
      }
      await loadPageData(normalizedClassId);
      alert('Subject assignments saved successfully.');
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Unable to save subject assignments.');
    } finally {
      setIsSaving(prev => ({ ...prev, [studentId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 overflow-hidden flex">
        <TeacherSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className={`flex-1 h-full overflow-y-auto pt-16 lg:pt-0 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
          <div className="p-4 lg:p-8">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                <p className="mt-4 text-gray-600">Loading combinations and student assignments...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex">
      <TeacherSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className={`flex-1 h-full overflow-y-auto pt-16 lg:pt-0 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <div className="p-4 lg:p-8">
          <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Subject Combinations</h1>
              <p className="text-gray-600 mt-2">Assign principals, subsidiary subjects, and combinations for your A-Level students.</p>
            </div>
            <Link href="/dashboard/teacher" className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50">
              Back to Dashboard
            </Link>
          </div>

          {errorMessage ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-700 mb-6">
              {errorMessage}
            </div>
          ) : (
            <>
              <div className="mb-6 rounded-lg bg-white shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Class {classId}</h2>
                    <p className="text-gray-600">The table below updates student combinations and A-Level subject assignments in the database.</p>
                  </div>
                  <div className="text-sm text-gray-500">Combinations available: {combinations.length}</div>
                </div>
              </div>

              <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stream</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Combination</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Combination</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal Subjects</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subsidiary</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No students found for class {classId}.</td>
                        </tr>
                      ) : (
                        students.map((student) => {
                          const draft = draftAssignments[student.id] || {
                            combination_code: student.subject_combination || '',
                            principal1: '',
                            principal2: '',
                            principal3: '',
                            subsidiary: ''
                          };

                          return (
                            <tr key={student.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.full_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.streams?.name || student.stream_id || 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.subject_combination || <span className="text-gray-400">Not set</span>}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <select
                                  value={draft.combination_code}
                                  onChange={(e) => setDraftAssignments(prev => ({
                                    ...prev,
                                    [student.id]: { ...draft, combination_code: e.target.value }
                                  }))}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
                                >
                                  <option value="">Leave unchanged</option>
                                  {combinations.map((combo) => (
                                    <option key={combo.id} value={combo.code}>{combo.code} — {combo.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="grid gap-2">
                                  <select
                                    value={draft.principal1}
                                    onChange={(e) => setDraftAssignments(prev => ({
                                      ...prev,
                                      [student.id]: { ...draft, principal1: e.target.value }
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
                                  >
                                    <option value="">Principal 1</option>
                                    {principalOptions.map((subject) => (
                                      <option key={`${student.id}-p1-${subject.id}`} value={subject.id}>{subject.name}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={draft.principal2}
                                    onChange={(e) => setDraftAssignments(prev => ({
                                      ...prev,
                                      [student.id]: { ...draft, principal2: e.target.value }
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
                                  >
                                    <option value="">Principal 2</option>
                                    {principalOptions.map((subject) => (
                                      <option key={`${student.id}-p2-${subject.id}`} value={subject.id}>{subject.name}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={draft.principal3}
                                    onChange={(e) => setDraftAssignments(prev => ({
                                      ...prev,
                                      [student.id]: { ...draft, principal3: e.target.value }
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
                                  >
                                    <option value="">Principal 3</option>
                                    {principalOptions.map((subject) => (
                                      <option key={`${student.id}-p3-${subject.id}`} value={subject.id}>{subject.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <select
                                  value={draft.subsidiary}
                                  onChange={(e) => setDraftAssignments(prev => ({
                                    ...prev,
                                    [student.id]: { ...draft, subsidiary: e.target.value }
                                  }))}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
                                >
                                  <option value="">Select subsidiary</option>
                                  {subsidiaryOptions.map((subject) => (
                                    <option key={`${student.id}-sub-${subject.id}`} value={subject.id}>{subject.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <button
                                  type="button"
                                  onClick={() => handleSaveAssignment(student.id)}
                                  disabled={isSaving[student.id]}
                                  className="inline-flex items-center px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isSaving[student.id] ? 'Saving...' : 'Save'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
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
