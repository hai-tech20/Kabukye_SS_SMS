'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TeacherSidebar from '@/components/sidebar/TeacherSidebar';

interface Teacher {
  id: string;
  full_name: string;
  is_class_teacher: boolean;
  class_teacher_class_id?: string;
}

interface StudentOptional {
  id: string;
  subject_id: string;
  subjects?: {
    id: string;
    name: string;
  };
}

interface Student {
  id: string;
  full_name: string;
  class_id?: string;
  stream_id?: string;
  streams?: { name: string };
  student_optional_subjects?: StudentOptional[];
}

interface Subject {
  id: string;
  name: string;
  class_id?: string;
}

const O_LEVEL_CLASSES = ['s1', 's2', 's3', 's4'];

export default function TeacherOptionalSubjectsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchClassOptionalSubjects = useCallback(async (classId: string) => {
    try {
      const normalizedClassId = classId.toLowerCase().trim();
      const response = await fetch(`/api/teachers/optional-subjects?class_id=${normalizedClassId}`);
      const result = await response.json();
      if (response.ok) {
        setStudents(result.data || []);
      } else {
        setErrorMessage(result.error || 'Failed to load student optional subjects.');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to load students.');
    }
  }, []);

  const fetchClassSubjects = useCallback(async (classId: string) => {
    try {
      const normalizedClassId = classId.toLowerCase().trim();
      const response = await fetch(`/api/subjects?class_id=${normalizedClassId}`);
      const result = await response.json();
      const data = Array.isArray(result) ? result : result.data || [];
      setSubjects(data || []);
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to load class subjects.');
    }
  }, []);

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
      if (!data?.is_class_teacher) {
        setErrorMessage('Only class teachers can manage optional subjects.');
        setLoading(false);
        return;
      }
      const teacherClassId = data.class_teacher_class_id?.toString() || '';
      const normalizedClassId = teacherClassId.toLowerCase().trim();
      if (!teacherClassId || !O_LEVEL_CLASSES.includes(normalizedClassId)) {
        setErrorMessage('This page is only available for S1-S4 class teachers.');
        setLoading(false);
        return;
      }
      await Promise.all([fetchClassOptionalSubjects(normalizedClassId), fetchClassSubjects(normalizedClassId)]);
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to load optional subject manager.');
    } finally {
      setLoading(false);
    }
  }, [fetchClassOptionalSubjects, fetchClassSubjects]);

  useEffect(() => {
    fetchTeacherData();
  }, [fetchTeacherData]);

  const handleAssignOptional = async (studentId: string) => {
    const subjectId = selectedSubject[studentId];
    if (!subjectId) {
      return;
    }
    setIsSaving(prev => ({ ...prev, [studentId]: true }));
    try {
      const response = await fetch('/api/teachers/optional-subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, subject_id: subjectId })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign optional subject');
      }
      await fetchClassOptionalSubjects(teacher?.class_teacher_class_id?.toString() || '');
      setSelectedSubject(prev => ({ ...prev, [studentId]: '' }));
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Unable to assign optional subject');
    } finally {
      setIsSaving(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const handleRemoveOptional = async (optionalId: string) => {
    if (!confirm('Remove this optional subject assignment?')) return;
    try {
      const response = await fetch(`/api/teachers/optional-subjects?id=${optionalId}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove optional subject');
      }
      if (teacher?.class_teacher_class_id) {
        await fetchClassOptionalSubjects(teacher.class_teacher_class_id.toString());
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Unable to remove optional subject');
    }
  };

  const classId = teacher?.class_teacher_class_id?.toString().toUpperCase() || '';

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex">
      <TeacherSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className={`flex-1 h-full overflow-y-auto pt-16 lg:pt-0 transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Optional Subjects</h1>
              <p className="text-gray-600 mt-2">Manage O-Level optional subjects for your class.</p>
            </div>
            <Link href="/dashboard/teacher" className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50">
              Back to Dashboard
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                <p className="mt-4 text-gray-600">Loading optional subjects...</p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-700">
              {errorMessage}
            </div>
          ) : (
            <>
              <div className="mb-6 rounded-lg bg-white shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Class {classId}</h2>
                    <p className="text-gray-600">Students in your class and their assigned optional subjects.</p>
                  </div>
                  <div className="text-sm text-gray-500">Available class subjects: {subjects.length}</div>
                </div>
              </div>

              <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stream</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Optional Subjects</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assign New Optional</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                            No students found for class {classId}.
                          </td>
                        </tr>
                      ) : (
                        students.map((student) => {
                          const assigned = student.student_optional_subjects || [];
                          return (
                            <tr key={student.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.full_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.streams?.name || student.stream_id || 'N/A'}</td>
                              <td className="px-6 py-4 text-sm text-gray-700">
                                {assigned.length > 0 ? (
                                  <div className="space-y-2">
                                    {assigned.map(item => (
                                      <div key={item.id} className="flex items-center justify-between rounded-md px-3 py-2 bg-gray-50 border border-gray-200">
                                        <span>{item.subjects?.name || 'Unknown subject'}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveOptional(item.id)}
                                          className="text-red-600 hover:text-red-800 text-xs"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">No optional subjects assigned</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <select
                                  value={selectedSubject[student.id] || ''}
                                  onChange={(e) => setSelectedSubject(prev => ({ ...prev, [student.id]: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-sm text-gray-900"
                                >
                                  <option value="">Select subject</option>
                                  {subjects.map((subject) => (
                                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <button
                                  type="button"
                                  onClick={() => handleAssignOptional(student.id)}
                                  disabled={!selectedSubject[student.id] || isSaving[student.id]}
                                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isSaving[student.id] ? 'Saving...' : 'Assign'}
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
