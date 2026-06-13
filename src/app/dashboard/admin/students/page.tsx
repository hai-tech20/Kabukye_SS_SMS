'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import AdminSidebar from '@/components/sidebar/AdminSidebar';

interface Student {
  id: string;
  full_name: string;
  class_id: string;
  stream_id: string;
  schoolpay_code: string;
  status: string;
  photo_url?: string;
  gender?: string;
  date_of_birth?: string;
  guardian_name?: string;
  guardian_phone?: string;
  subject_combination?: string;
  sms_classes?: { name: string };
  sms_streams?: { name: string };
}

interface Subject {
  id: string;
  name: string;
  subject_type: string;
  class_id: string;
}

export default function StudentsManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [modalClassId, setModalClassId] = useState('');
  const [modalStreamId, setModalStreamId] = useState('');
  const [modalStreams, setModalStreams] = useState<any[]>([]);
  const [allStreamsData, setAllStreamsData] = useState<any[]>([]);
  
  // Subject selection states
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [principal1, setPrincipal1] = useState('');
  const [principal2, setPrincipal2] = useState('');
  const [principal3, setPrincipal3] = useState('');
  const [subsidiary, setSubsidiary] = useState('');
  const [manualCombination, setManualCombination] = useState('');
  const [studentDetailSubjects, setStudentDetailSubjects] = useState<any[]>([]);
  const [optional1, setOptional1] = useState('');
  const [optional2, setOptional2] = useState('');
  const [studentOptionalSubjects, setStudentOptionalSubjects] = useState<any[]>([]);
  
  // Photo upload state for edit mode
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  
  // Refs for request deduplication
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);

  const fetchStudents = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('Skipping fetch - already in progress');
      return;
    }
    
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    isFetchingRef.current = true;
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClassId) params.append('class_id', selectedClassId);
      if (selectedStreamId) params.append('stream_id', selectedStreamId);
      // Add cache-busting timestamp
      params.append('t', Date.now().toString());

      const response = await fetch(`/api/students?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Transform the data to include class and stream names
      const transformedStudents = (result.data || []).map((student: any) => ({
        ...student,
        sms_classes: { name: student.classes?.name || student.class_id || 'Unknown' },
        sms_streams: { name: student.streams?.name || student.stream_id || 'Unknown' }
      }));
      
      setStudents(transformedStudents);
    } catch (error: any) {
      // Don't log aborted requests as errors
      if (error.name === 'AbortError') {
        console.log('Fetch aborted - newer request in progress');
        return;
      }
      console.error('Error fetching students:', error);
      setStudents([]);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [selectedClassId, selectedStreamId]);

  const fetchClasses = useCallback(async () => {
    try {
      const response = await fetch('/api/classes');
      const result = await response.json();
      setClasses(result.data?.classes || []);
      // Pre-set streams if we have data
      const allStreams = result.data?.streams || [];
      setAllStreamsData(allStreams);
    } catch (error) {
      console.error('Error fetching classes:', error);
      setClasses([]);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Replace fetchStreams with local filtering
  const [allStreams, setAllStreams] = useState<any[]>([]);
  
  useEffect(() => {
    if (selectedClassId) {
      const streams = allStreamsData.filter((stream: { class_id: string }) => stream.class_id === selectedClassId);
      setStreams(streams);
    } else {
      setStreams([]);
    }
  }, [selectedClassId, allStreamsData]);

  useEffect(() => {
    // Refetch students when stream changes
    fetchStudents();
  }, [selectedStreamId, fetchStudents]);

  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId);
    setSelectedStreamId('');
  };

  const handleModalClassChange = useCallback(async (classId: string) => {
    setModalClassId(classId);
    setModalStreamId('');
    if (classId) {
      const classStreams = allStreamsData.filter((stream: { class_id: string }) => stream.class_id === classId);
      setModalStreams(classStreams);
    } else {
      setModalStreams([]);
    }
  }, [allStreamsData]);

  // Fetch student subjects when editing
  const fetchStudentSubjects = useCallback(async (studentId: string) => {
    try {
      const response = await fetch(`/api/student-subjects?student_id=${studentId}`);
      const result = await response.json();
      if (response.ok && result.data) {
        const studentSubjects = result.data;
        console.log('Student subjects fetched:', studentSubjects);
        
        // Separate principal and subsidiary subjects
        // Note: subject_id is directly on the student_subjects record
        const principalSubjects = studentSubjects.filter((s: any) => s.is_principal === true);
        const subsidiarySubjects = studentSubjects.filter((s: any) => s.is_principal === false);
        
        console.log('Principal subjects:', principalSubjects);
        console.log('Subsidiary subjects:', subsidiarySubjects);
        
        // Set principal subjects (up to 3)
        if (principalSubjects[0]) {
          console.log('Setting principal1:', principalSubjects[0].subject_id);
          setPrincipal1(principalSubjects[0].subject_id);
        }
        if (principalSubjects[1]) {
          console.log('Setting principal2:', principalSubjects[1].subject_id);
          setPrincipal2(principalSubjects[1].subject_id);
        }
        if (principalSubjects[2]) {
          console.log('Setting principal3:', principalSubjects[2].subject_id);
          setPrincipal3(principalSubjects[2].subject_id);
        }
        
        // Set subsidiary subject
        if (subsidiarySubjects[0]) {
          console.log('Setting subsidiary:', subsidiarySubjects[0].subject_id);
          setSubsidiary(subsidiarySubjects[0].subject_id);
        }
      } else {
        console.log('No student subjects data:', result);
      }
    } catch (error) {
      console.error('Error fetching student subjects:', error);
    }
  }, []);

  // Fetch student subjects for details view (with subject names)
  const fetchStudentDetailSubjects = useCallback(async (studentId: string) => {
    try {
      const response = await fetch(`/api/student-subjects?student_id=${studentId}`);
      const result = await response.json();
      if (response.ok && result.data) {
        setStudentDetailSubjects(result.data);
      } else {
        setStudentDetailSubjects([]);
      }
    } catch (error) {
      console.error('Error fetching student detail subjects:', error);
      setStudentDetailSubjects([]);
    }
  }, []);

  // Fetch subjects when modal opens - MUST be defined before useEffect that uses it
  const fetchSubjects = useCallback(async () => {
    try {
      const response = await fetch('/api/subjects');
      const result = await response.json();
      if (response.ok) {
        // API returns subjects array directly (not wrapped in data)
        const allSubjects = Array.isArray(result) ? result : (result.data || []);
        console.log('All subjects fetched:', allSubjects.length);
        
        // Remove duplicates based on BOTH name AND class_id
        // This ensures S5 Agriculture and S6 Agriculture are kept as separate subjects
        const uniqueSubjectsMap = new Map();
        allSubjects.forEach((s: Subject) => {
          // Create unique key combining name + class_id
          const classId = (s.class_id || 'none').toString().toLowerCase().trim();
          const key = `${s.name.toLowerCase().trim()}_${classId}`;
          if (!uniqueSubjectsMap.has(key)) {
            uniqueSubjectsMap.set(key, s);
          }
        });
        const uniqueSubjects = Array.from(uniqueSubjectsMap.values());
        console.log('Unique subjects after dedup:', uniqueSubjects.length);
        console.log('Sample subjects:', uniqueSubjects.slice(0, 10).map(s => ({ name: s.name, class_id: s.class_id })));
        
        // Keep all subjects for the selected class so O-Level forms can include S1-S4 optionals too
        setSubjects(uniqueSubjects);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  }, []);

  useEffect(() => {
    if (editingStudent) {
      handleModalClassChange(editingStudent.class_id);
      setModalStreamId(editingStudent.stream_id);
      // Set manual combination from editing student's subject_combination
      setManualCombination(editingStudent.subject_combination || '');
      // Reset new photo file when opening edit modal
      setNewPhotoFile(null);
      // Fetch subjects first, then fetch student subjects
      // We need to ensure subjects are loaded before setting the dropdown values
      fetchSubjects().then(() => {
        // After subjects are loaded, fetch and set the student's subjects
        fetchStudentSubjects(editingStudent.id);
      });
    }
  }, [editingStudent, handleModalClassChange, fetchStudentSubjects, fetchSubjects]);

  // Fetch subjects when modal opens
  useEffect(() => {
    if (showAddModal || editingStudent) {
      fetchSubjects();
    }
  }, [showAddModal, editingStudent, fetchSubjects]);

  // Reset subject selection when modal closes
  useEffect(() => {
    if (!showAddModal && !editingStudent) {
      setPrincipal1('');
      setPrincipal2('');
      setPrincipal3('');
      setSubsidiary('');
      setManualCombination('');
    }
  }, [showAddModal, editingStudent]);

  // Auto-suggest subsidiary based on principal subjects
  useEffect(() => {
    const hasMath = subjects.find(s => s.id === principal1 || s.id === principal2 || s.id === principal3)?.name.toLowerCase().includes('mathematics');
    
    if (hasMath) {
      // If Mathematics is selected, suggest Sub ICT
      const subIct = subjects.find(s => s.name.toLowerCase().includes('sub ict'));
      if (subIct) setSubsidiary(subIct.id);
    } else if (principal1 && principal2 && principal3) {
      // If no Mathematics, suggest Sub Math
      const subMath = subjects.find(s => s.name.toLowerCase().includes('sub mathematics') || s.name.toLowerCase().includes('sub math'));
      if (subMath) setSubsidiary(subMath.id);
    }
  }, [principal1, principal2, principal3, subjects]);

  const handleAddStudent = async (formData: FormData) => {
    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        const studentId = result.data?.id;
        
        // If O-Level student (S1-S4) and optional subjects selected, assign them
        if (studentId && (modalClassId === 's1' || modalClassId === 's2' || modalClassId === 's3' || modalClassId === 's4')) {
          if (optional1) {
            await fetch('/api/student-optional-subjects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ student_id: studentId, subject_id: optional1 })
            });
          }
          if (optional2) {
            await fetch('/api/student-optional-subjects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ student_id: studentId, subject_id: optional2 })
            });
          }
        }
        
        // If A-Level student and subjects selected, assign them
        if (studentId && (modalClassId === 's5' || modalClassId === 's6') && principal1 && principal2 && principal3 && subsidiary) {
          const subjectsToAssign = [
            { student_id: studentId, subject_id: principal1, subject_type: 'principal' },
            { student_id: studentId, subject_id: principal2, subject_type: 'principal' },
            { student_id: studentId, subject_id: principal3, subject_type: 'principal' },
            { student_id: studentId, subject_id: subsidiary, subject_type: 'subsidiary' }
          ];
          
          // Find General Paper and add it as compulsory
          const gpSubject = subjects.find(s => s.name.toLowerCase().includes('general paper'));
          if (gpSubject) {
            subjectsToAssign.push({
              student_id: studentId,
              subject_id: gpSubject.id,
              subject_type: 'compulsory'
            });
          }
          
          // Assign subjects
          await fetch('/api/student-subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: studentId,
              subjects: subjectsToAssign,
              combination_code: manualCombination || ''
            })
          });
        }
        
        setShowAddModal(false);
        setModalClassId('');
        setModalStreamId('');
        setModalStreams([]);
        setPrincipal1('');
        setPrincipal2('');
        setPrincipal3('');
        setSubsidiary('');
        setManualCombination('');
        setOptional1('');
        setOptional2('');
        fetchStudents();
        alert(result.message || 'Student added successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add student');
      }
    } catch (error) {
      console.error('Error adding student:', error);
      alert('Failed to add student');
    }
  };

  const handleEditStudent = async (formData: FormData) => {
    if (!editingStudent) return;
    
    try {
      const response = await fetch(`/api/students/${editingStudent.id}`, {
        method: 'PUT',
        body: formData
      });
      
      if (response.ok) {
        setEditingStudent(null);
        setModalClassId('');
        setModalStreamId('');
        setModalStreams([]);
        fetchStudents();
        alert('Student updated successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update student');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      alert('Failed to update student');
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchStudents();
      } else {
        console.error('Failed to delete student');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  };

  const filteredStudents = students.filter((student) =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.schoolpay_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - Fixed Position */}
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content - Scrollable */}
      <div className={`transition-all duration-300 pt-16 lg:pt-0 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
              <p className="text-gray-600 mt-2">Manage student records and information</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Admin User</span>
              <button 
                onClick={() => window.location.href = '/api/auth/logout'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                <p className="mt-4 text-gray-600">Loading students...</p>
              </div>
            </div>
          ) : (
          <>
          {/* Filters and Search */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <input
                  type="text"
                  placeholder="Search by name or SchoolPay code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                />
              </div>
              <div>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                >
                  <option value="">All Classes</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={selectedStreamId}
                  onChange={(e) => setSelectedStreamId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                >
                  <option value="">All Streams</option>
                  {streams
                    .filter(stream => !selectedClassId || stream.class_id === selectedClassId)
                    .map((stream) => (
                      <option key={stream.id} value={stream.id}>{stream.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full bg-blue-900 text-white rounded-lg px-6 py-3 font-medium hover:bg-blue-800"
                >
                  Add Student
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stream</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SchoolPay Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Combination</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.photo_url ? (
                          <img
                            src={`${student.photo_url}?t=${Date.now()}`}
                            alt={student.full_name}
                            className="h-10 w-10 rounded-full object-cover border-2 border-gray-200"
                            onError={(e) => {
                              console.error('Failed to load photo:', student.photo_url);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            fetchStudentDetailSubjects(student.id);
                            setShowDetailsModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {student.full_name}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.sms_classes?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.sms_streams?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.schoolpay_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.subject_combination || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          student.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="text-blue-900 hover:text-blue-700 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredStudents.map((student) => (
              <div key={student.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <div className="flex items-start mb-3">
                  <div className="mr-3 flex-shrink-0">
                    {student.photo_url ? (
                      <img
                        src={`${student.photo_url}?t=${Date.now()}`}
                        alt={student.full_name}
                        className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="h-12 w-12 bg-gray-300 rounded-full flex items-center justify-center">
                        <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{student.full_name}</h3>
                    <p className="text-sm text-gray-500">{student.schoolpay_code}</p>
                    <p className="text-sm text-gray-500">{student.sms_classes?.name} - {student.sms_streams?.name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {student.status}
                  </span>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setEditingStudent(student)}
                      className="text-blue-900 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
          )}

          {/* Add/Edit Modal */}
          {(showAddModal || editingStudent) && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-10 mx-auto p-5 border w-[550px] shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingStudent ? 'Edit Student' : 'Add New Student'}
                  </h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    
                    // Debug: Check if photo is in formData
                    const photoFile = formData.get('photo');
                    console.log('Form submitted. Photo file:', photoFile);
                    console.log('Photo is File?', photoFile instanceof File);
                    console.log('Photo size:', (photoFile as File)?.size);
                    
                    if (editingStudent) {
                      handleEditStudent(formData);
                    } else {
                      handleAddStudent(formData);
                    }
                  }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          name="full_name"
                          defaultValue={editingStudent?.full_name}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <select
                          name="gender"
                          defaultValue={editingStudent?.gender}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          name="date_of_birth"
                          defaultValue={editingStudent?.date_of_birth}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                        <select
                          name="class_id"
                          defaultValue={editingStudent?.class_id}
                          onChange={(e) => handleModalClassChange(e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                        >
                          <option value="">Select Class</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stream</label>
                        <select
                          name="stream_id"
                          value={modalStreamId}
                          onChange={(e) => setModalStreamId(e.target.value)}
                          disabled={!modalClassId}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 disabled:bg-gray-100"
                        >
                          <option value="">Select Stream</option>
                          {modalStreams.map((stream) => (
                            <option key={stream.id} value={stream.id}>{stream.name}</option>
                          ))}
                        </select>
                      </div>
                      {/* Subject Selection for A-Level Students */}
                      {modalClassId && (modalClassId === 's5' || modalClassId === 's6') && (
                        <div className="col-span-2 border-t pt-4 mt-2">
                          <label className="block text-sm font-medium text-gray-900 mb-3">
                            Select Subjects <span className="text-red-500">*</span>
                          </label>
                          
                          {/* Principal Subject 1 */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Principal Subject 1</label>
                            <select
                              value={principal1}
                              onChange={(e) => setPrincipal1(e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                            >
                              <option value="">-- Select Subject --</option>
                              {subjects
                                .filter(s => {
                                  // Filter by class_id to match selected class (S5 or S6)
                                  const subjectClassId = (s.class_id || '').toString().toLowerCase().trim();
                                  const selectedClassId = (modalClassId || '').toString().toLowerCase().trim();
                                  const matchesClass = subjectClassId === selectedClassId;
                                  
                                  // Exclude General Paper and Subsidiary subjects only
                                  const name = s.name.toLowerCase();
                                  const isGeneralPaper = name.includes('general paper');
                                  const isSubIct = name.includes('sub ict');
                                  const isSubMath = name.includes('sub mathematics') || name === 'sub math';
                                  const isSubsidiary = s.subject_type === 'subsidiary' || isSubIct || isSubMath || isGeneralPaper;
                                  
                                  return matchesClass && !isSubsidiary;
                                })
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                          </div>
                          
                          {/* Principal Subject 2 */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Principal Subject 2</label>
                            <select
                              value={principal2}
                              onChange={(e) => setPrincipal2(e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                            >
                              <option value="">-- Select Subject --</option>
                              {subjects
                                .filter(s => {
                                  // Filter by class_id to match selected class (S5 or S6)
                                  const subjectClassId = (s.class_id || '').toString().toLowerCase().trim();
                                  const selectedClassId = (modalClassId || '').toString().toLowerCase().trim();
                                  const matchesClass = subjectClassId === selectedClassId;
                                  
                                  // Exclude General Paper, Subsidiary subjects, and already selected
                                  const name = s.name.toLowerCase();
                                  const isGeneralPaper = name.includes('general paper');
                                  const isSubIct = name.includes('sub ict');
                                  const isSubMath = name.includes('sub mathematics') || name === 'sub math';
                                  const isSubsidiary = s.subject_type === 'subsidiary' || isSubIct || isSubMath || isGeneralPaper;
                                  return matchesClass && !isSubsidiary && s.id !== principal1;
                                })
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                          </div>
                          
                          {/* Principal Subject 3 */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Principal Subject 3</label>
                            <select
                              value={principal3}
                              onChange={(e) => setPrincipal3(e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                            >
                              <option value="">-- Select Subject --</option>
                              {subjects
                                .filter(s => {
                                  // Filter by class_id to match selected class (S5 or S6)
                                  const subjectClassId = (s.class_id || '').toString().toLowerCase().trim();
                                  const selectedClassId = (modalClassId || '').toString().toLowerCase().trim();
                                  const matchesClass = subjectClassId === selectedClassId;
                                  
                                  // Exclude General Paper, Subsidiary subjects, and already selected
                                  const name = s.name.toLowerCase();
                                  const isGeneralPaper = name.includes('general paper');
                                  const isSubIct = name.includes('sub ict');
                                  const isSubMath = name.includes('sub mathematics') || name === 'sub math';
                                  const isSubsidiary = s.subject_type === 'subsidiary' || isSubIct || isSubMath || isGeneralPaper;
                                  return matchesClass && !isSubsidiary && s.id !== principal1 && s.id !== principal2;
                                })
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                          </div>
                          
                          {/* Subsidiary Subject */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Subsidiary Subject
                              {subsidiary && (
                                <span className="text-green-600 ml-2">
                                  (Auto-selected based on principals)
                                </span>
                              )}
                            </label>
                            <select
                              value={subsidiary}
                              onChange={(e) => setSubsidiary(e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                            >
                              <option value="">-- Select Subsidiary --</option>
                              {subjects
                                .filter(s => {
                                  // Filter by class_id to match selected class (S5 or S6)
                                  const subjectClassId = (s.class_id || '').toString().toLowerCase().trim();
                                  const selectedClassId = (modalClassId || '').toString().toLowerCase().trim();
                                  const matchesClass = subjectClassId === selectedClassId;
                                  
                                  const name = s.name.toLowerCase();
                                  // Only Sub ICT and Sub Mathematics
                                  const isSubsidiary = name.includes('sub ict') || name.includes('sub mathematics') || name.includes('sub math');
                                  return matchesClass && isSubsidiary;
                                })
                                .map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                          </div>
                          
                          {/* Manual Combination Entry */}
                          <div className="mt-4">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Subject Combination (e.g., PCM, BCM, HEG)</label>
                            <input
                              type="text"
                              name="subject_combination"
                              value={manualCombination}
                              onChange={(e) => setManualCombination(e.target.value.toUpperCase())}
                              placeholder="Enter combination code"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Hidden input for non-A-Level classes */}
                      {(!modalClassId || (modalClassId !== 's5' && modalClassId !== 's6')) && (
                        <input type="hidden" name="subject_combination" value="" />
                      )}
                      
                      {/* Optional Subjects Selection for O-Level Students (S1-S4) */}
                      {modalClassId && (modalClassId === 's1' || modalClassId === 's2' || modalClassId === 's3' || modalClassId === 's4') && (
                        <div className="col-span-2 border-t pt-4 mt-2">
                          <label className="block text-sm font-medium text-gray-900 mb-3">
                            Select Optional Subjects <span className="text-gray-500">(up to 2)</span>
                          </label>
                          
                          {/* Optional Subject 1 */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Optional Subject 1</label>
                            <select
                              value={optional1}
                              onChange={(e) => setOptional1(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                            >
                              <option value="">-- None --</option>
                              {subjects
                                .filter(s => {
                                  const subjectClassId = (s.class_id || '').toString().toLowerCase().trim();
                                  const selectedClassId = (modalClassId || '').toString().toLowerCase().trim();
                                  return subjectClassId === selectedClassId;
                                })
                                .filter(s => s.id !== optional2) // Don't show if already selected as optional2
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                          </div>
                          
                          {/* Optional Subject 2 */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Optional Subject 2</label>
                            <select
                              value={optional2}
                              onChange={(e) => setOptional2(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                            >
                              <option value="">-- None --</option>
                              {subjects
                                .filter(s => {
                                  const subjectClassId = (s.class_id || '').toString().toLowerCase().trim();
                                  const selectedClassId = (modalClassId || '').toString().toLowerCase().trim();
                                  return subjectClassId === selectedClassId;
                                })
                                .filter(s => s.id !== optional1) // Don't show if already selected as optional1
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SchoolPay Code</label>
                        <input
                          type="text"
                          name="schoolpay_code"
                          defaultValue={editingStudent?.schoolpay_code}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label>
                        <input
                          type="text"
                          name="guardian_name"
                          defaultValue={editingStudent?.guardian_name}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone</label>
                        <input
                          type="tel"
                          name="guardian_phone"
                          defaultValue={editingStudent?.guardian_phone}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Photo {editingStudent?.photo_url && !newPhotoFile && <span className="text-green-600 font-normal">(Added)</span>}
                        </label>
                        <div className="relative">
                          {/* Show existing photo preview when editing and no new photo selected */}
                          {editingStudent?.photo_url && !newPhotoFile && (
                            <div className="flex items-center gap-3 mb-2 p-2 bg-gray-50 rounded-md">
                              <img
                                src={`${editingStudent.photo_url}?t=${Date.now()}`}
                                alt="Current"
                                className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                              />
                              <span className="text-sm text-gray-600">Current photo</span>
                            </div>
                          )}
                          {/* File input with custom styling */}
                          <div className="flex items-center gap-2">
                            <label className="flex-1 cursor-pointer">
                              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                                {/* Plus icon */}
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-sm text-gray-600">
                                  {newPhotoFile ? newPhotoFile.name : (editingStudent?.photo_url ? 'Replace photo' : 'Add photo')}
                                </span>
                              </div>
                              <input
                                type="file"
                                name="photo"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setNewPhotoFile(file);
                                }}
                                className="hidden"
                              />
                            </label>
                            {/* Clear button if new photo selected */}
                            {newPhotoFile && (
                              <button
                                type="button"
                                onClick={() => setNewPhotoFile(null)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Remove selected photo"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModal(false);
                          setEditingStudent(null);
                          setModalClassId('');
                          setModalStreamId('');
                          setModalStreams([]);
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                      >
                        {editingStudent ? 'Update' : 'Add'} Student
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Student Details Modal */}
          {showDetailsModal && selectedStudent && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Student Details</h3>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        setSelectedStudent(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Profile Photo */}
                    <div className="flex justify-center">
                      {selectedStudent.photo_url ? (
                        <img
                          src={`${selectedStudent.photo_url}?t=${Date.now()}`}
                          alt={selectedStudent.full_name}
                          className="h-24 w-24 rounded-full object-cover border-4 border-gray-200"
                          onError={(e) => {
                            console.error('Failed to load photo:', selectedStudent.photo_url);
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="h-24 w-24 bg-gray-300 rounded-full flex items-center justify-center border-4 border-gray-200">
                          <svg className="h-12 w-12 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Student Information */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <p className="mt-1 text-sm text-gray-900 font-semibold">{selectedStudent.full_name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Gender</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedStudent.gender}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedStudent.date_of_birth}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Class</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedStudent.sms_classes?.name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Stream</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedStudent.sms_streams?.name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">SchoolPay Code</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedStudent.schoolpay_code}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <span className={`mt-1 inline-flex px-2 py-1 text-xs leading-5 font-semibold rounded-full ${
                          selectedStudent.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedStudent.status}
                        </span>
                      </div>
                      {selectedStudent.subject_combination && (
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Subject Combination</label>
                          <p className="mt-1 text-sm text-gray-900 font-semibold">{selectedStudent.subject_combination}</p>
                        </div>
                      )}
                    </div>

                    {/* Subjects Information - Only for A-Level students */}
                    {(selectedStudent.class_id === 's5' || selectedStudent.class_id === 's6') && studentDetailSubjects.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="text-md font-medium text-gray-900 mb-3">Subjects</h4>
                        <div className="space-y-2">
                          {studentDetailSubjects.map((subject: any, index: number) => (
                            <div key={subject.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                              <span className="text-sm text-gray-700">
                                {index + 1}. {subject.subjects?.name || 'Unknown Subject'}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                subject.is_principal 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {subject.is_principal ? 'Principal' : 'Subsidiary'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Guardian Information */}
                    {(selectedStudent.guardian_name || selectedStudent.guardian_phone) && (
                      <div className="border-t pt-4">
                        <h4 className="text-md font-medium text-gray-900 mb-3">Guardian Information</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedStudent.guardian_name && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Guardian Name</label>
                              <p className="mt-1 text-sm text-gray-900">{selectedStudent.guardian_name}</p>
                            </div>
                          )}
                          {selectedStudent.guardian_phone && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Guardian Phone</label>
                              <p className="mt-1 text-sm text-gray-900">{selectedStudent.guardian_phone}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          setSelectedStudent(null);
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          setEditingStudent(selectedStudent);
                          setShowAddModal(true);
                        }}
                        className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                      >
                        Edit Student
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}

