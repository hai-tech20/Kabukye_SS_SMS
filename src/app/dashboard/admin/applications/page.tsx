'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminSidebar from '@/components/sidebar/AdminSidebar';

interface Application {
  id: number;
  student_full_name: string;
  gender: string;
  date_of_birth: string;
  former_school: string;
  class_applying_for: string;
  parent_guardian_full_name: string;
  parent_guardian_phone: string;
  district: string;
  created_at: string;
  subjects_and_grades: any;
  optional_subject: any;
  subject_combination: string;
}

export default function ApplicationsManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [approving, setApproving] = useState(false);
  
  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');

  // Fetch applications on mount
  useEffect(() => {
    fetchApplications();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...applications];
    
    if (filterClass) {
      filtered = filtered.filter(app => app.class_applying_for === filterClass);
    }
    if (filterGender) {
      filtered = filtered.filter(app => app.gender === filterGender);
    }
    if (filterDistrict) {
      filtered = filtered.filter(app => app.district === filterDistrict);
    }
    
    setFilteredApplications(filtered);
  }, [applications, filterClass, filterGender, filterDistrict]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/applications');
      const data = await response.json();
      if (response.ok) {
        setApplications(data.applications || []);
        setFilteredApplications(data.applications || []);
      } else {
        console.error('Error fetching applications:', data.error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (application: Application) => {
    setSelectedApplication(application);
    setShowDetailModal(true);
  };

  const handleApproveClick = (application: Application) => {
    setSelectedApplication(application);
    setShowApproveConfirm(true);
  };

  const handleApprove = async () => {
    if (!selectedApplication) return;

    try {
      setApproving(true);
      const response = await fetch(`/api/applications/${selectedApplication.id}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Application approved! Student created with ID: ${data.studentId}`);
        setShowApproveConfirm(false);
        setShowDetailModal(false);
        fetchApplications();
      } else {
        const data = await response.json();
        alert('Error approving application: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error approving application');
    } finally {
      setApproving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this application?')) {
      return;
    }

    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchApplications();
      } else {
        const data = await response.json();
        alert('Error deleting application: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error deleting application');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get unique values for filters
  const uniqueClasses = [...new Set(applications.map(app => app.class_applying_for))].filter(Boolean);
  const uniqueDistricts = [...new Set(applications.map(app => app.district))].filter(Boolean);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Fixed Position */}
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className={`flex-1 ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'} overflow-y-auto min-h-screen`}>
        <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Student Applications</h1>
          <p className="text-gray-600 mt-1">
            Total: <span className="font-semibold text-blue-600">{filteredApplications.length}</span> application{filteredApplications.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class Applying For</label>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          >
            <option value="">All Classes</option>
            {uniqueClasses.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
          <select
            value={filterDistrict}
            onChange={(e) => setFilterDistrict(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          >
            <option value="">All Districts</option>
            {uniqueDistricts.map(district => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </div>

        {(filterClass || filterGender || filterDistrict) && (
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterClass('');
                setFilterGender('');
                setFilterDistrict('');
              }}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Applications Table */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Applying For</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Former School</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">District</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Applied</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
{filteredApplications.map((application) => (
                   <tr key={application.id} className="hover:bg-gray-100 border-b border-gray-200">
                     <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                       <div className="font-medium text-gray-900">{application.student_full_name}</div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                       <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                         application.gender === 'Male' ? 'bg-blue-200 text-blue-900' : 'bg-pink-200 text-pink-900'
                       }`}>
                         {application.gender}
                       </span>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200 text-gray-900 font-medium">{application.class_applying_for}</td>
                     <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200 text-gray-800">{application.former_school || '-'}</td>
                     <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200 text-gray-800">{application.district}</td>
                     <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200 text-gray-700">{formatDate(application.created_at)}</td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex gap-2">
                         <button
                           onClick={() => handleView(application)}
                           className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 font-medium text-sm"
                         >
                           View
                         </button>
                         <button
                           onClick={() => handleDelete(application.id)}
                           className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 font-medium text-sm"
                         >
                           Delete
                         </button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredApplications.length === 0 && (
        <div className="text-center py-16">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-lg">No applications found.</p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Application Details</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Personal Information */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Full Name</label>
                    <p className="font-medium">{selectedApplication.student_full_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Gender</label>
                    <p className="font-medium">{selectedApplication.gender}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Date of Birth</label>
                    <p className="font-medium">{selectedApplication.date_of_birth}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Class Applying For</label>
                    <p className="font-medium">{selectedApplication.class_applying_for}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Former School</label>
                    <p className="font-medium">{selectedApplication.former_school || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">District</label>
                    <p className="font-medium">{selectedApplication.district}</p>
                  </div>
                </div>
              </div>

              {/* Parent/Guardian Information */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Parent/Guardian Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Full Name</label>
                    <p className="font-medium">{selectedApplication.parent_guardian_full_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Phone</label>
                    <p className="font-medium">{selectedApplication.parent_guardian_phone}</p>
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Academic Information</h3>
                
                {(() => {
                  const subjectsList = (() => {
                    const sg = selectedApplication.subjects_and_grades;
                    if (!sg) return [];
                    if (Array.isArray(sg)) return sg;
                    if (typeof sg === 'object') {
                      return Object.entries(sg).map(([subject, grade]) => ({
                        subject: subject.replace(/_/g, ' '),
                        grade: typeof grade === 'string' ? grade : (grade as any)?.grade || ''
                      }));
                    }
                    return [];
                  })();

                  return subjectsList.length > 0 ? (
                    <div className="mb-4">
                      <label className="text-sm text-gray-500 mb-2 block">Subjects and Grades</label>
                      <table className="w-full border">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left border">Subject</th>
                            <th className="px-4 py-2 text-left border">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjectsList.map((item: any, index: number) => (
                            <tr key={index}>
                              <td className="px-4 py-2 border">{item.subject}</td>
                              <td className="px-4 py-2 border">{item.grade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic mb-4">No academic grades recorded.</p>
                  );
                })()}

                {(() => {
                  const optSubject = (() => {
                    const opt = selectedApplication.optional_subject;
                    if (!opt) return null;
                    if (typeof opt === 'object') {
                      if (opt.subject && opt.grade) {
                        return { subject: opt.subject, grade: opt.grade };
                      }
                      const entries = Object.entries(opt);
                      if (entries.length > 0) {
                        return { subject: entries[0][0].replace(/_/g, ' '), grade: String(entries[0][1]) };
                      }
                    }
                    if (typeof opt === 'string') {
                      return { subject: opt, grade: '' };
                    }
                    return null;
                  })();

                  return optSubject ? (
                    <div className="mb-4">
                      <label className="text-sm text-gray-500 mb-2 block">Optional Subject</label>
                      <table className="w-full border">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left border">Subject</th>
                            <th className="px-4 py-2 text-left border">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-4 py-2 border">{optSubject.subject}</td>
                            <td className="px-4 py-2 border">{optSubject.grade}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : null;
                })()}

                {selectedApplication.subject_combination && (
                  <div>
                    <label className="text-sm text-gray-500">Subject Combination</label>
                    <p className="font-medium">{selectedApplication.subject_combination}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowApproveConfirm(true);
                  }}
                  disabled={approving}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Approve Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Dialog */}
      {showApproveConfirm && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Approve Application?</h3>
              <p className="text-gray-600">
                This will add <strong>{selectedApplication.student_full_name}</strong> to the SMS system as a new student.
              </p>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowApproveConfirm(false)}
                disabled={approving}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {approving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  'Confirm Approval'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
