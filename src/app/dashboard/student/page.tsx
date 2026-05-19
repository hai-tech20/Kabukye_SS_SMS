'use client';

import { useState, useEffect } from 'react';
import { getCurrentTerm } from '@/lib/academic-calendar';

interface ReportCard {
  id: string;
  academic_year: string;
  term: string;
  file_url: string;
  status: string;
}

interface Student {
  id: string;
  full_name: string;
  schoolpay_code: string;
  class_id: string;
  stream_id: string;
  classes: { name: string };
  streams: { name: string };
}

interface Mark {
  id: string;
  subject_id: string;
  bot_score: number;
  mot_score: number;
  eot_score: number;
  final_score: number;
  academic_year: string;
  term: string;
  p1_score?: number | null;
  p2_score?: number | null;
  p3_score?: number | null;
  subjects: {
    name: string;
    paper_count: number;
  };
}

export default function StudentDashboard() {
  const [student, setStudent] = useState<Student | null>(null);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'results' | 'reports'>('overview');

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      // Get session
      const sessionRes = await fetch('/api/auth/me');
      if (!sessionRes.ok) {
        window.location.href = '/login/student';
        return;
      }
      const session = await sessionRes.json();
      
      // Get student details
      const studentRes = await fetch(`/api/students/${session.id}`);
      if (studentRes.ok) {
        const { data } = await studentRes.json();
        setStudent(data);
      }

      // Get current term/year
      const currentTerm = getCurrentTerm();
      const termMap: { [key: string]: string } = { 'Term I': '1', 'Term II': '2', 'Term III': '3' };
      const termNumber = termMap[currentTerm.name] || '1';

      // Get report cards
      const reportsRes = await fetch(`/api/reports/published?student_id=${session.id}`);
      if (reportsRes.ok) {
        const { data } = await reportsRes.json();
        setReportCards(data || []);
      }

      // Get real-time marks - Aligned with teacher class results logic
      const marksRes = await fetch(`/api/grades?student_id=${session.id}&term=${termNumber}&year=${currentTerm.academicYear}`);
      if (marksRes.ok) {
        const { data } = await marksRes.json();
        setMarks(data || []);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = '/api/auth/logout';
    }
  };

  const handleBackToWebsite = () => {
    window.location.href = '/api/auth/logout?redirect=http://localhost:3000';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
              <img 
                src="/media/badge.png" 
                alt="School Badge" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const span = document.createElement('span');
                    span.className = 'text-blue-900 font-bold';
                    span.innerText = 'K';
                    parent.appendChild(span);
                  }
                }}
              />
            </div>
            <h1 className="font-bold text-lg hidden sm:block">Student Portal</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToWebsite}
              className="flex items-center px-3 py-2 bg-blue-800 hover:bg-blue-700 rounded-lg transition-colors text-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Website
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back, {student?.full_name}</p>
          </div>
          <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-blue-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'results' ? 'bg-blue-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Real-time Marks
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-blue-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Report Cards
            </button>
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Class</h3>
                <p className="text-2xl font-bold text-gray-900">{student?.classes?.name}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Stream</h3>
                <p className="text-2xl font-bold text-gray-900">{student?.streams?.name}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase">SchoolPay Code</h3>
                <p className="text-2xl font-bold text-gray-900">{student?.schoolpay_code}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg flex items-start space-x-4">
              <div className="bg-blue-100 p-2 rounded-full">
                <svg className="w-6 h-6 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-blue-900">Welcome to your Portal</h4>
                <p className="text-blue-800 text-sm mt-1">
                  You can now review your marks in real-time as they are entered by your teachers. 
                  Use the tabs above to switch between your current marks and published report cards.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Real-time Marks Review</h2>
              <p className="text-gray-600 text-sm mt-1">Review your scores as they are saved by your teachers. These marks are read-only.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paper Scores</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase text-center">BOT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase text-center">MOT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase text-center">EOT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase text-center font-bold">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term / Year</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {marks.length > 0 ? (
                    marks.map((mark) => (
                      <tr key={mark.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {mark.subjects?.name || `Subject ID: ${mark.subject_id}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {mark.p1_score !== undefined && mark.p1_score !== null && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                P1: {mark.p1_score}
                              </span>
                            )}
                            {mark.p2_score !== undefined && mark.p2_score !== null && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                P2: {mark.p2_score}
                              </span>
                            )}
                            {mark.p3_score !== undefined && mark.p3_score !== null && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                P3: {mark.p3_score}
                              </span>
                            )}
                            {!(mark.p1_score || mark.p2_score || mark.p3_score) && (
                              <span className="text-xs text-gray-400 italic">No papers saved</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                          {mark.bot_score ?? '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                          {mark.mot_score ?? '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                          {mark.eot_score ?? '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`text-sm font-bold ${mark.final_score !== null && mark.final_score !== undefined ? 'text-blue-900' : 'text-gray-400'}`}>
                            {mark.final_score ?? '-'}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          T{mark.term}, {mark.academic_year}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No marks have been entered for you yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">My Report Cards</h2>
              <p className="text-gray-600 text-sm mt-1">View and download your official academic performance reports</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Academic Year</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportCards.length > 0 ? (
                    reportCards.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{report.academic_year}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Term {report.term}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Published
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <a 
                            href={report.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900 font-bold"
                          >
                            View Report
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        No report cards available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
