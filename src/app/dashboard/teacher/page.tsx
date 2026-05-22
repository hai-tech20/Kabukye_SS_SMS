'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TeacherSidebar from '@/components/sidebar/TeacherSidebar';

interface TeacherAssignment {
  id: string;
  class_id: string;
  stream_id: string;
  subject_id: string;
  classes?: { name: string };
  streams?: { name: string };
  subjects?: { name: string };
  sms_classes?: { name: string };
  sms_streams?: { name: string };
  sms_subjects?: { name: string };
}

interface Teacher {
  id: string;
  full_name: string;
  is_class_teacher: boolean;
  class_teacher_class_id?: string;
  class_teacher_stream_id?: string;
}

export default function TeacherDashboard() {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<{ class_id: string; class_name: string; subject_id: string; subject_name: string } | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [selectedStream, setSelectedStream] = useState<string>('ALL');
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetchTeacherData();
  }, []);

  const fetchTeacherData = async () => {
    try {
      // Fetch current session to get teacher info
      const sessionResponse = await fetch('/api/auth/me');
      if (!sessionResponse.ok) {
        window.location.href = '/login/teacher';
        return;
      }
      const session = await sessionResponse.json();
      const teacherId = session.id;
      
      // Fetch teacher subjects
      const assignmentsResponse = await fetch('/api/teacher/subjects');
      if (assignmentsResponse.ok) {
        const { data } = await assignmentsResponse.json();
        setAssignments(data || []);
      }
      
      // Fetch teacher info
      const teacherResponse = await fetch(`/api/teachers/${teacherId}`);
      if (teacherResponse.ok) {
        const { data } = await teacherResponse.json();
        setTeacher(data);
      }
    } catch (error) {
      console.error('Error fetching teacher data:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchStudentsForClass = async (classId: string, subjectId: string) => {
    try {
      setStudentsLoading(true);
      setStudents([]); // Clear previous students
      
      // Fetch students for this class
      const studentsResponse = await fetch(`/api/students?class_id=${classId}`);
      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json();
        setStudents(studentsData.data || []);
      }
      
      // Fetch streams for this class
      const streamsResponse = await fetch('/api/classes');
      if (streamsResponse.ok) {
        const classesData = await streamsResponse.json();
        const allStreams = classesData.data?.streams || [];
        const classStreams = allStreams.filter((stream: any) => stream.class_id === classId);
        setStreams(classStreams);
      }
      
      setSelectedStream('ALL');
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleClassClick = (classId: string, className: string, subjectId: string, subjectName: string) => {
    setSelectedClass({ class_id: classId, class_name: className, subject_id: subjectId, subject_name: subjectName });
    fetchStudentsForClass(classId, subjectId);
  };

  const getUniqueClasses = () => {
    const classMap = new Map();
    
    assignments.forEach(assignment => {
      const key = assignment.class_id;
      if (!classMap.has(key)) {
        classMap.set(key, {
          class_id: assignment.class_id,
          class_name: assignment.classes?.name || assignment.sms_classes?.name || assignment.class_id,
          subjects: []
        });
      }
      classMap.get(key).subjects.push({
        subject_id: assignment.subject_id,
        subject_name: assignment.subjects?.name || assignment.sms_subjects?.name || 'Unknown Subject',
        stream_id: assignment.stream_id,
        stream_name: assignment.streams?.name || assignment.sms_streams?.name || 'Unknown Stream'
      });
    });
    
    return Array.from(classMap.values());
  };

  const getFilteredStudents = () => {
    if (selectedStream === 'ALL') {
      return students;
    }
    return students.filter(student => student.stream_id === selectedStream);
  };

  const teacherClassId = teacher?.class_teacher_class_id?.toString().toLowerCase().trim();
  const isClassTeacherForOLevel = !!teacherClassId && ['s1', 's2', 's3', 's4'].includes(teacherClassId);
  const isClassTeacherForALevel = !!teacherClassId && ['s5', 's6'].includes(teacherClassId);

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex">
      {/* Sidebar - Fixed Position */}
      <TeacherSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content - Scrollable */}
      <div className={`flex-1 h-full overflow-y-auto pt-16 lg:pt-0 transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
              <p className="text-gray-600 mt-2">Welcome back, {teacher?.full_name || 'Teacher'}</p>
            </div>
          </div>

          {initialLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                <p className="mt-4 text-gray-600">Loading dashboard...</p>
              </div>
            </div>
          ) : (
          <>
          {/* Assigned Classes */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">My Classes</h2>
              {selectedClass && (
                <button
                  onClick={() => setSelectedClass(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                >
                  ← Back to Classes
                </button>
              )}
            </div>

            {!selectedClass ? (
              // Show unique classes
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getUniqueClasses().map((classItem) => (
                  <div 
                    key={classItem.class_id} 
                    className="border border-gray-200 rounded-lg p-4 bg-white"
                  >
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-900 text-lg">{classItem.class_name}</h3>
                      <p className="text-sm text-gray-600">Your assigned classes</p>
                    </div>
                    <div className="border-t pt-2">
                      <p className="text-xs text-gray-500 mb-2">Subjects you teach:</p>
                      <div className="flex flex-wrap gap-1">
                        {classItem.subjects.map((subject: any, index: number) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {subject.subject_name} ({subject.stream_name})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Show students for selected class
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedClass.class_name} - {selectedClass.subject_name}
                  </h3>
                  
                  {/* Stream Filter */}
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Stream:</label>
                    <select
                      value={selectedStream}
                      onChange={(e) => setSelectedStream(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-sm text-gray-900"
                    >
                      <option value="ALL">All Streams</option>
                      {streams.map(stream => (
                        <option key={stream.id} value={stream.id}>{stream.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Enter Marks Button */}
                  <div className="mt-4">
                    <Link
                      href={`/dashboard/teacher/marks?class_id=${selectedClass.class_id}&stream_id=${selectedStream}&subject_id=${selectedClass.subject_id}`}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Enter Marks
                    </Link>
                  </div>
                </div>

                {/* Students Table */}
                {studentsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-900"></div>
                    <p className="mt-2 text-gray-600">Loading students...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {selectedClass.subject_name} Marks
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getFilteredStudents().map((student) => (
                          <tr key={student.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {student.full_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {/* This would show marks for the subject - placeholder for now */}
                              <span className="text-gray-400">-</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {getFilteredStudents().length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No students found for this selection.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!selectedClass && getUniqueClasses().length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No classes assigned yet. Please contact the administrator.
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teacher?.is_class_teacher && isClassTeacherForOLevel && (
                <Link
                  href="/dashboard/teacher/optional-subjects"
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-full mr-4">
                      <svg className="w-6 h-6 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Manage Optional Subjects</h3>
                      <p className="text-sm text-gray-600 mt-1">Assign and update O-Level optionals for your class</p>
                    </div>
                  </div>
                </Link>
              )}
              {teacher?.is_class_teacher && isClassTeacherForALevel && (
                <Link
                  href="/dashboard/teacher/combinations"
                  className="bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-full mr-4">
                      <svg className="w-6 h-6 text-purple-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm0 2c-2.21 0-4 1.79-4 4v1h8v-1c0-2.21-1.79-4-4-4zM5 20h14" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Manage Combinations</h3>
                      <p className="text-sm text-gray-600 mt-1">Update subject combinations for your S5/S6 class</p>
                    </div>
                  </div>
                </Link>
              )}
              {teacher?.is_class_teacher && (
                <Link
                  href="/dashboard/teacher/class-results"
                  className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-full mr-4">
                      <svg className="w-6 h-6 text-green-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Review Class Results</h3>
                      <p className="text-sm text-gray-600 mt-1">View overall class performance</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
