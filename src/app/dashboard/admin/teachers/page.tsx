'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminSidebar from '@/components/sidebar/AdminSidebar';

interface Teacher {
  id: string;
  full_name: string;
  teacher_code: string;
  email: string;
  role: 'admin' | 'bursar' | 'teacher' | 'class_teacher';
  status: string;
  phone?: string;
  gender?: string;
  is_class_teacher?: boolean;
  class_teacher_class_id?: string;
  class_teacher_stream_id?: string;
  teacher_subjects?: Array<{
    id: string;
    subject_id: string;
    class_id: string;
    stream_id: string;
    subjects?: { name: string };
    classes?: { name: string };
    streams?: { name: string };
  }>;
}

type FormRole = 'admin' | 'bursar' | 'teacher' | 'class_teacher';

export default function TeachersManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState<{
    full_name: string;
    teacher_code: string;
    email: string;
    role: FormRole;
    class_id: string;
    stream_id: string;
    phone: string;
    gender: string;
  }>({
    full_name: '',
    teacher_code: '',
    email: '',
    role: 'teacher' as FormRole,
    class_id: '',
    stream_id: '',
    phone: '',
    gender: ''
  });
  const [classes, setClasses] = useState<any[]>([]);
  const [allStreams, setAllStreams] = useState<any[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectAssignments, setSubjectAssignments] = useState<{
    subject_id: string;
    class_id: string;
    stream_id: string;
  }[]>([]);

  useEffect(() => {
    fetchTeachers();
    fetchAcademicData();
  }, []);

  const fetchAcademicData = async () => {
    try {
      const response = await fetch('/api/classes');
      const result = await response.json();
      if (result.data) {
        setClasses(result.data.classes || []);
        setAllStreams(result.data.streams || []);
        setSubjects(result.data.subjects || []);
      }
    } catch (error) {
      console.error('Error fetching academic data:', error);
    }
  };

  useEffect(() => {
    if (formData.class_id) {
      const streams = allStreams.filter(s => s.class_id === formData.class_id);
      setFilteredStreams(streams);
    } else {
      setFilteredStreams([]);
    }
  }, [formData.class_id, allStreams]);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('full_name', formData.full_name);
      data.append('teacher_code', formData.teacher_code);
      data.append('email', formData.email);
      data.append('role', formData.role === 'class_teacher' ? 'teacher' : formData.role);
      data.append('phone', formData.phone);
      data.append('gender', formData.gender);
      
      if (formData.role === 'class_teacher') {
        data.append('is_class_teacher', 'true');
        data.append('class_teacher_class_id', formData.class_id);
        data.append('class_teacher_stream_id', formData.stream_id);
      } else {
        data.append('is_class_teacher', 'false');
      }

      const finalSubjectAssignments = formData.role === 'class_teacher' && formData.class_id && formData.stream_id 
        ? [
            ...subjectAssignments,
            {
              subject_id: '',
              class_id: formData.class_id,
              stream_id: formData.stream_id
            }
          ]
        : subjectAssignments;

      data.append('subject_assignments', JSON.stringify(finalSubjectAssignments));

      const response = await fetch('/api/teachers', {
        method: 'POST',
        body: data,
      });

      if (response.ok) {
        setShowAddModal(false);
        setEditingTeacher(null);
        resetForm();
        fetchTeachers();
        alert('Teacher added successfully!');
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to add teacher');
      }
    } catch (error) {
      console.error('Error adding teacher:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    
    try {
      const data = new FormData();
      data.append('full_name', formData.full_name);
      data.append('teacher_code', formData.teacher_code);
      data.append('email', formData.email);
      data.append('role', formData.role === 'class_teacher' ? 'teacher' : formData.role);
      data.append('phone', formData.phone);
      data.append('gender', formData.gender);
      
      if (formData.role === 'class_teacher') {
        data.append('is_class_teacher', 'true');
        data.append('class_teacher_class_id', formData.class_id);
        data.append('class_teacher_stream_id', formData.stream_id);
      } else {
        data.append('is_class_teacher', 'false');
      }

      const finalSubjectAssignments = formData.role === 'class_teacher' && formData.class_id && formData.stream_id 
        ? [
            ...subjectAssignments,
            {
              subject_id: '',
              class_id: formData.class_id,
              stream_id: formData.stream_id
            }
          ]
        : subjectAssignments;

      data.append('subject_assignments', JSON.stringify(finalSubjectAssignments));

      const response = await fetch(`/api/teachers/${editingTeacher.id}`, {
        method: 'PUT',
        body: data,
      });

      if (response.ok) {
        setShowAddModal(false);
        setEditingTeacher(null);
        resetForm();
        fetchTeachers();
        alert('Teacher updated successfully');
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to update teacher');
      }
    } catch (error) {
      console.error('Error updating teacher:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!confirm('Are you sure you want to delete this teacher? This action cannot be undone.')) return;
    
    try {
      const response = await fetch(`/api/teachers/${teacherId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTeachers();
        alert('Teacher deleted successfully');
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to delete teacher');
      }
    } catch (error) {
      console.error('Error deleting teacher:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({ 
      full_name: '', 
      teacher_code: '', 
      email: '', 
      role: 'teacher',
      class_id: '',
      stream_id: '',
      phone: '',
      gender: ''
    });
    setSubjectAssignments([]);
  };

  const addSubjectAssignment = () => {
    setSubjectAssignments([
      { subject_id: '', class_id: '', stream_id: '' },
      ...subjectAssignments
    ]);
  };

  const updateSubjectAssignment = (index: number, field: 'subject_id' | 'class_id' | 'stream_id', value: string) => {
    const updated = [...subjectAssignments];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'class_id') {
      updated[index].stream_id = '';
      updated[index].subject_id = '';
    }
    
    setSubjectAssignments(updated);
  };

  const getSubjectsForClass = (classId: string) => {
    if (!classId) return subjects;
    
    const isOLevel = ['s1', 's2', 's3', 's4'].includes(classId);
    const isALevel = ['s5', 's6'].includes(classId);
    
    if (isOLevel) {
      // Filter O-Level subjects by both 'o-' prefix AND class_id to prevent duplicates
      return subjects.filter(subject => 
        subject.id.startsWith('o-') && subject.class_id === classId
      );
    } else if (isALevel) {
      return subjects.filter(subject => 
        subject.id.startsWith('a-') && subject.class_id === classId
      );
    }
    
    return subjects;
  };

  const removeSubjectAssignment = (index: number) => {
    setSubjectAssignments(subjectAssignments.filter((_, i) => i !== index));
  };

  const openDetailsModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setSelectedTeacher(null);
    setShowDetailsModal(false);
  };

  const openEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      full_name: teacher.full_name,
      teacher_code: teacher.teacher_code,
      email: teacher.email,
      role: teacher.is_class_teacher ? 'class_teacher' as const : teacher.role,
      class_id: teacher.class_teacher_class_id || '',
      stream_id: teacher.class_teacher_stream_id || '',
      phone: teacher.phone || '',
      gender: teacher.gender || ''
    });
    
    if (teacher.teacher_subjects && teacher.teacher_subjects.length > 0) {
      const assignments = teacher.teacher_subjects.map((subject: any) => ({
        subject_id: subject.subject_id,
        class_id: subject.class_id,
        stream_id: subject.stream_id
      }));
      setSubjectAssignments(assignments);
    } else {
      setSubjectAssignments([]);
    }
    
    setShowAddModal(true);
  };

  const fetchTeachers = async () => {
    try {
      const response = await fetch('/api/teachers');
      const result = await response.json();
      setTeachers(result.data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'bursar':
        return 'bg-yellow-100 text-yellow-800';
      case 'teacher':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
              <h1 className="text-3xl font-bold text-gray-900">Teachers Management</h1>
              <p className="text-gray-600 mt-2">Manage teacher accounts and permissions</p>
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
                <p className="mt-4 text-gray-600">Loading teachers...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header with Add Button */}
              <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">All Teachers</h2>
                    <p className="text-gray-600 mt-1">{teachers.length} teachers registered</p>
                  </div>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-900 text-white px-6 py-2 rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  >
                    Add Teacher
                  </button>
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {teachers.map((teacher) => (
                      <tr key={teacher.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{teacher.full_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{teacher.teacher_code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{teacher.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(teacher.role)}`}>
                            {teacher.role.charAt(0).toUpperCase() + teacher.role.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            teacher.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {teacher.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => openDetailsModal(teacher)}
                            className="text-green-600 hover:text-green-800 mr-2"
                          >
                            View
                          </button>
                          <button 
                            onClick={() => openEditModal(teacher)}
                            className="text-blue-900 hover:text-blue-700 mr-2"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteTeacher(teacher.id)}
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

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {teachers.map((teacher) => (
                  <div key={teacher.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-800">{teacher.full_name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${getRoleBadgeColor(teacher.role)}`}>
                        {teacher.role.charAt(0).toUpperCase() + teacher.role.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-1">Code: {teacher.teacher_code}</p>
                    <p className="text-sm text-gray-500 mb-1">{teacher.email}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        teacher.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {teacher.status}
                      </span>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => openDetailsModal(teacher)}
                          className="text-green-600 text-sm font-medium"
                        >
                          View
                        </button>
                        <button 
                          onClick={() => openEditModal(teacher)}
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
        </div>
      </div>

      {/* Teacher Details Modal */}
      {showDetailsModal && selectedTeacher && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Teacher Details</h3>
                <button
                  onClick={closeDetailsModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="border-b pb-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name</label>
                      <p className="mt-1 text-sm text-gray-900 font-semibold">{selectedTeacher.full_name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Teacher Code</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedTeacher.teacher_code}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedTeacher.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedTeacher.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Gender</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedTeacher.gender || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <span className={`mt-1 inline-flex px-2 py-1 text-xs leading-5 font-semibold rounded-full ${
                        selectedTeacher.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedTeacher.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-b pb-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Role Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Role</label>
                      <span className={`mt-1 inline-flex px-2 py-1 text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(selectedTeacher.role)}`}>
                        {selectedTeacher.role.charAt(0).toUpperCase() + selectedTeacher.role.slice(1)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Class Teacher</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedTeacher.is_class_teacher ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>

                <div className="pb-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Subject Assignments</h4>
                  {selectedTeacher.teacher_subjects && selectedTeacher.teacher_subjects.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTeacher.teacher_subjects.map((subject: any, index: number) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600">Subject</label>
                              <p className="mt-1 text-sm text-gray-900 font-medium">{subject.subjects?.name || 'Unknown'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600">Class</label>
                              <p className="mt-1 text-sm text-gray-900">{subject.classes?.name || 'Unknown'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600">Stream</label>
                              <p className="mt-1 text-sm text-gray-900">{subject.streams?.name || 'Unknown'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No subjects assigned</p>
                  )}
                </div>

                {selectedTeacher.is_class_teacher && (
                  <div className="pb-4">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Class Assignment</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Assigned Class</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedTeacher.class_teacher_class_id || 'Not assigned'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Assigned Stream</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedTeacher.class_teacher_stream_id || 'Not assigned'}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      closeDetailsModal();
                      openEditModal(selectedTeacher);
                    }}
                    className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                  >
                    Edit Teacher
                  </button>
                  <button
                    onClick={closeDetailsModal}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Teacher Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
              </h3>
              <form onSubmit={editingTeacher ? handleEditTeacher : handleAddTeacher} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teacher Code</label>
                  <input
                    type="text"
                    value={formData.teacher_code}
                    onChange={(e) => setFormData({ ...formData, teacher_code: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gender</label>
                  <select 
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any, class_id: '', stream_id: '' })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="class_teacher">Class Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {formData.role === 'class_teacher' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Class</label>
                      <select 
                        value={formData.class_id}
                        onChange={(e) => setFormData({ ...formData, class_id: e.target.value, stream_id: '' })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                        required
                      >
                        <option value="">Select Class</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Stream</label>
                      <select 
                        value={formData.stream_id}
                        onChange={(e) => setFormData({ ...formData, stream_id: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-gray-900"
                        required
                        disabled={!formData.class_id}
                      >
                        <option value="">Select Stream</option>
                        {filteredStreams.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-medium text-gray-900">Subject Assignments</h4>
                    <button
                      type="button"
                      onClick={addSubjectAssignment}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                    >
                      Add Subject
                    </button>
                  </div>
                  
                  {subjectAssignments.map((assignment, index) => (
                    <div key={index} className="border rounded-md p-4 mb-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-gray-700">Assignment {index + 1}</h5>
                        {subjectAssignments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSubjectAssignment(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Subject</label>
                          <select
                            value={assignment.subject_id}
                            onChange={(e) => updateSubjectAssignment(index, 'subject_id', e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-sm"
                            disabled={!assignment.class_id}
                          >
                            <option value="">Select Subject</option>
                            {getSubjectsForClass(assignment.class_id).map(subject => (
                              <option key={subject.id} value={subject.id}>{subject.name}</option>
                            ))}
                          </select>
                          {!assignment.class_id && (
                            <p className="text-xs text-gray-500 mt-1">Select class first</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Class</label>
                          <select
                            value={assignment.class_id}
                            onChange={(e) => updateSubjectAssignment(index, 'class_id', e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-sm"
                          >
                            <option value="">Select Class</option>
                            {classes.map(cls => (
                              <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Stream</label>
                          <select
                            value={assignment.stream_id}
                            onChange={(e) => updateSubjectAssignment(index, 'stream_id', e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-900 focus:border-blue-900 text-sm"
                            disabled={!assignment.class_id}
                          >
                            <option value="">Select Stream</option>
                            {allStreams
                              .filter(stream => stream.class_id === assignment.class_id)
                              .map(stream => (
                                <option key={stream.id} value={stream.id}>{stream.name}</option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-xs text-blue-800 italic">
                    * Password will be auto-generated based on rule: first 4 letters of name + teacher code.
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingTeacher(null);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                  >
                    {editingTeacher ? 'Update Teacher' : 'Add Teacher'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
