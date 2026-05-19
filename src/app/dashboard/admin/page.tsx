'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminSidebar from '@/components/sidebar/AdminSidebar';

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [totalStreams, setTotalStreams] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = '/api/auth/logout';
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh when window regains focus (e.g., after adding a student)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Add cache-busting parameter to prevent browser caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/dashboard/overview?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const result = await response.json();

      console.log('Dashboard API response:', result);

      if (result.success) {
        setTotalStudents(result.data.counts.students);
        setTotalTeachers(result.data.counts.teachers);
        setTotalClasses(result.data.counts.classes);
        setTotalStreams(result.data.counts.streams);
      } else {
        console.error('Dashboard API error:', result.error);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setTotalStudents(0);
      setTotalTeachers(0);
      setTotalClasses(0);
      setTotalStreams(0);
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
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-2">Welcome to Kabukye Secondary School</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
              <span className="text-sm text-gray-600">Admin User</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                <p className="mt-4 text-gray-600">Loading dashboard...</p>
              </div>
            </div>
          ) : (
          <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900">Total Students</h3>
              <p className="text-2xl font-bold text-blue-900">{totalStudents}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900">Total Teachers</h3>
              <p className="text-2xl font-bold text-green-900">{totalTeachers}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900">Active Classes</h3>
              <p className="text-2xl font-bold text-purple-900">{totalClasses}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900">Active Streams</h3>
              <p className="text-2xl font-bold text-orange-900">{totalStreams}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/dashboard/admin/students" className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:border-blue-300">
                <h3 className="text-lg font-medium text-gray-900">Add Student</h3>
                <p className="text-sm text-gray-500">Register a new student</p>
              </Link>
              <Link href="/dashboard/admin/teachers" className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:border-blue-300">
                <h3 className="text-lg font-medium text-gray-900">Add Teacher</h3>
                <p className="text-sm text-gray-500">Register a new teacher</p>
              </Link>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
