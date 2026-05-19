'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCurrentTerm } from '@/lib/academic-calendar';
import AdminSidebar from '@/components/sidebar/AdminSidebar';

interface Class {
  id: string;
  name: string;
  academic_year: string;
  term: string;
  student_count?: number;
}

interface Stream {
  id: string;
  name: string;
  class_id: string;
  student_count?: number;
}

export default function ClassesManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAcademicInfo, setCurrentAcademicInfo] = useState(getCurrentTerm());

  useEffect(() => {
    fetchData();
    // Update academic info every minute to stay current
    const interval = setInterval(() => {
      setCurrentAcademicInfo(getCurrentTerm());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/classes');
      const result = await response.json();
      
      if (result.error) {
        console.error('API Error:', result.error);
        return;
      }

      const classesData = result.data?.classes || [];
      const streamsData = result.data?.streams || [];

      // Sort classes in order: S1, S2, S3, S4, S5, S6
      const sortedClasses = classesData.sort((a: Class, b: Class) => {
        const order = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
        const aIndex = order.indexOf(a.name);
        const bIndex = order.indexOf(b.name);
        return aIndex - bIndex;
      });

      // Sort streams alphabetically within each class
      const sortedStreams = streamsData.sort((a: Stream, b: Stream) => a.name.localeCompare(b.name));

      setClasses(sortedClasses);
      setStreams(sortedStreams);
    } catch (error) {
      console.error('Error fetching classes:', error);
      setClasses([]);
      setStreams([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex">
      {/* Sidebar - Fixed Position */}
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content - Scrollable */}
      <div className={`flex-1 h-full overflow-y-auto transition-all duration-300 pt-16 lg:pt-0 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Classes & Streams</h1>
              <p className="text-gray-600 mt-2">View and manage classes and streams</p>
              <div className="mt-2 text-sm text-blue-600 font-medium">
                {currentAcademicInfo.name} - {currentAcademicInfo.academicYear} ({currentAcademicInfo.days} days)
              </div>
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
                <p className="mt-4 text-gray-600">Loading classes...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Classes and Streams Section */}
              <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            {classes.map((classItem, index) => (
              <div key={classItem.id}>
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  {/* Class Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {classItem.name || 'Unknown Class'} - {classItem.academic_year || '2025'} ({classItem.term || 'Term 1'})
                      </h3>
                      <p className="text-gray-600 mt-1">
                        {classItem.student_count || 0} students enrolled
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm">
                        Add Stream
                      </button>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                        Assign Subjects
                      </button>
                    </div>
                  </div>

                  {/* Streams as Horizontal Badges */}
                  <div className="mt-4">
                    <div className="flex items-center mb-3">
                      <span className="text-sm font-medium text-gray-700">Streams:</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {streams
                        .filter((stream) => stream.class_id === classItem.id)
                        .sort((a: Stream, b: Stream) => a.name.localeCompare(b.name))
                        .map((stream) => (
                          <div key={stream.id} className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-200 transition-colors">
                            <div className="text-center">
                              <div className="font-medium text-gray-900">
                                {stream.name || 'Unknown'} - {stream.student_count || 0} {stream.student_count === 1 ? 'student' : 'students'}
                              </div>
                              <div className="flex justify-center space-x-3 mt-2">
                                <button className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                                <button className="text-red-600 hover:text-red-800 text-xs">Delete</button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
                
                {/* Divider line between classes */}
                {index < classes.length - 1 && (
                  <div className="border-t border-gray-200 my-6"></div>
                )}
              </div>
            ))}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
