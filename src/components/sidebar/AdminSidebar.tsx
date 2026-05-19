'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard/admin', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/dashboard/admin/students', label: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { href: '/dashboard/admin/teachers', label: 'Teachers', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/dashboard/admin/classes', label: 'Classes & Streams', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { href: '/dashboard/admin/reports', label: 'Report Cards', icon: 'M9 17v-2m3 2v-4m3 2v-6m-8 13h11a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { href: '/dashboard/admin/posts', label: 'Website Posts', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { href: '/dashboard/admin/applications', label: 'Applications', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/dashboard/admin/academic-management', label: 'Academic Management', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
];

interface AdminSidebarProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

export default function AdminSidebar({ sidebarOpen: externalSidebarOpen, setSidebarOpen: externalSetSidebarOpen }: AdminSidebarProps = {}) {
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(true);
  
  // Use external state if provided, otherwise use internal state
  const sidebarOpen = externalSidebarOpen !== undefined ? externalSidebarOpen : internalSidebarOpen;
  const setSidebarOpen = externalSetSidebarOpen || setInternalSidebarOpen;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = '/api/auth/logout';
    }
  };

  const handleBackToWebsite = () => {
    // Log out first to ensure session is cleared
    window.location.href = '/api/auth/logout?redirect=http://localhost:3000';
  };

  const isActive = (href: string) => {
    if (href === '/dashboard/admin') {
      return pathname === '/dashboard/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-blue-900 z-50 flex items-center justify-between px-4">
        <h1 className="text-white font-bold text-lg">KSS Admin</h1>
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
          {navItems.map((item) => (
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
          ))}
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
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Header with Toggle */}
        <div className="p-3 flex items-center justify-between">
          <h2 className={`text-white font-bold text-lg transition-opacity duration-300 whitespace-nowrap overflow-hidden ${
            sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
          }`}>
            KSS Admin
          </h2>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white hover:bg-blue-800 p-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"} />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-1 overflow-hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-1.5 text-white transition-colors mx-2 rounded-lg ${
                isActive(item.href) ? 'bg-blue-800' : 'hover:bg-blue-800'
              }`}
            >
              <svg className={`w-5 h-5 flex-shrink-0 ${sidebarOpen ? 'mr-4' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className={`transition-opacity duration-300 whitespace-nowrap overflow-hidden ${
                sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
              }`}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-blue-800 space-y-1.5">
          <button 
            onClick={handleBackToWebsite}
            className={`w-full bg-blue-700 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center py-2 ${
              sidebarOpen ? 'px-3' : 'px-2'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className={`ml-2 transition-opacity duration-300 whitespace-nowrap overflow-hidden text-sm ${
              sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
            }`}>
              Back to Website
            </span>
          </button>
          <button 
            onClick={handleLogout}
            className={`w-full bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center py-2 ${
              sidebarOpen ? 'px-3' : 'px-2'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={`ml-2 transition-opacity duration-300 whitespace-nowrap overflow-hidden text-sm ${
              sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
            }`}>
              Logout
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
