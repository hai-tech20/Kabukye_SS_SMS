'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const navItems = [
  { href: '/dashboard/teacher', label: 'My Subjects', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/dashboard/teacher/marks', label: 'Marks Entry', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/dashboard/teacher/optional-subjects', label: 'Optional Subjects', icon: 'M12 8v4l3 3m6 2a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h12z' },
  { href: '/dashboard/teacher/combinations', label: 'Combinations', icon: 'M7 8h10M7 12h7m-7 4h4M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/dashboard/teacher/grades', label: 'View Grade Stats', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/dashboard/teacher/class-results', label: 'Review Class Results', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
];

type TeacherSidebarProps = {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
};

export default function TeacherSidebar({ sidebarOpen, setSidebarOpen }: TeacherSidebarProps) {
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [teacher, setTeacher] = useState<{ is_class_teacher?: boolean; class_teacher_class_id?: string } | null>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(true);
  const pathname = usePathname();
  const isControlled = typeof sidebarOpen === 'boolean' && typeof setSidebarOpen === 'function';
  const desktopOpen = isControlled ? sidebarOpen : internalSidebarOpen;

  useEffect(() => {
    const fetchTeacher = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const json = await res.json();
        setTeacher(json);
        } catch (error) {
          console.error('Failed to fetch teacher session for sidebar', error);
        } finally {
          setLoadingTeacher(false);
        }
    };
    fetchTeacher();
  }, []);

  const toggleDesktopSidebar = () => {
    if (isControlled && setSidebarOpen) {
      setSidebarOpen(!desktopOpen);
    } else {
      setInternalSidebarOpen(!desktopOpen);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = '/api/auth/logout';
    }
  };

  const handleBackToWebsite = () => {
    window.location.href = '/api/auth/logout?redirect=website';
  };

  const isActive = (href: string) => {
    if (href === '/dashboard/teacher') {
      return pathname === '/dashboard/teacher';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-blue-900 z-50 flex items-center justify-between px-4">
        <h1 className="text-white font-bold text-lg">KSS Teacher</h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-white p-2 hover:bg-blue-800 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div 
        className={`lg:hidden fixed top-16 left-0 bottom-0 w-64 bg-blue-900 z-40 transform transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex-1 py-4">
          {(() => {
            const base = ['/dashboard/teacher', '/dashboard/teacher/marks', '/dashboard/teacher/grades'];
            let allowed: string[] = [];

            if (loadingTeacher) {
              // While loading, show base items to avoid flicker
              allowed = base;
            } else if (!teacher || !teacher.is_class_teacher) {
              // Not a class teacher: only base pages
              allowed = base;
            } else {
              const classId = teacher.class_teacher_class_id?.toString().toLowerCase().trim();
              if (['s1', 's2', 's3', 's4'].includes(classId || '')) {
                allowed = [...base, '/dashboard/teacher/optional-subjects'];
              } else if (['s5', 's6'].includes(classId || '')) {
                allowed = [...base, '/dashboard/teacher/combinations'];
              } else {
                allowed = base;
              }
            }

            return navItems.filter(item => allowed.includes(item.href)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center px-6 py-4 text-white transition-colors ${
                isActive(item.href) ? 'bg-blue-800' : 'hover:bg-blue-800'
              }`}
            >
              <svg className="w-6 h-6 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span>{item.label}</span>
            </Link>
            ));
          })()}
        </nav>
        <div className="p-4 border-t border-blue-800 space-y-2">
          <button 
            onClick={handleBackToWebsite}
            className="w-full bg-blue-700 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center text-sm"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Website
          </button>
          <button 
            onClick={handleLogout}
            className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center text-sm"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Desktop Sidebar - Fixed Position */}
      <div 
        className={`hidden lg:flex flex-col bg-blue-900 h-full fixed left-0 top-0 z-50 transition-all duration-300 ${
          desktopOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Header with Toggle */}
        <div className="p-4 flex items-center justify-between">
          <h2 className={`text-white font-bold text-xl transition-opacity duration-300 whitespace-nowrap overflow-hidden ${
            desktopOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
          }`}>
            KSS Teacher
          </h2>
          <button 
            onClick={toggleDesktopSidebar}
            className="text-white hover:bg-blue-800 p-2 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={desktopOpen ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"} />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {(() => {
            const base = ['/dashboard/teacher', '/dashboard/teacher/marks', '/dashboard/teacher/grades'];
            let allowed: string[] = [];

            if (loadingTeacher) {
              allowed = base;
            } else if (!teacher || !teacher.is_class_teacher) {
              allowed = base;
            } else {
              const classId = teacher.class_teacher_class_id?.toString().toLowerCase().trim();
              if (['s1', 's2', 's3', 's4'].includes(classId || '')) {
                allowed = [...base, '/dashboard/teacher/optional-subjects'];
              } else if (['s5', 's6'].includes(classId || '')) {
                allowed = [...base, '/dashboard/teacher/combinations'];
              } else {
                allowed = base;
              }
            }

            return navItems.filter(item => allowed.includes(item.href)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 text-white transition-colors mx-2 rounded-lg ${
                isActive(item.href) ? 'bg-blue-800' : 'hover:bg-blue-800'
              }`}
            >
              <svg className={`w-6 h-6 flex-shrink-0 ${desktopOpen ? 'mr-4' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className={`transition-opacity duration-300 whitespace-nowrap overflow-hidden ${
                desktopOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
              }`}>
                {item.label}
              </span>
            </Link>
            ));
          })()}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-blue-800 space-y-2">
          <button 
            onClick={handleBackToWebsite}
            className={`w-full bg-blue-700 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center py-3 ${
              desktopOpen ? 'px-4' : 'px-2'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className={`ml-2 transition-opacity duration-300 whitespace-nowrap overflow-hidden ${
              desktopOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
            }`}>
              Back to Website
            </span>
          </button>
          <button 
            onClick={handleLogout}
            className={`w-full bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center py-3 ${
              desktopOpen ? 'px-4' : 'px-2'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={`ml-2 transition-opacity duration-300 whitespace-nowrap overflow-hidden ${
              desktopOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
            }`}>
              Logout
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
