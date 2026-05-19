'use client';

import { useState } from 'react';

type Role = 'admin' | 'teacher' | 'student';

type RoleLoginPageProps = {
  role: Role;
};

export default function RoleLoginPage({ role }: RoleLoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [teacherCode, setTeacherCode] = useState('');
  const [schoolpayCode, setSchoolpayCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const body =
        role === 'admin'
          ? { loginType: 'admin', email, password }
          : role === 'teacher'
            ? { loginType: 'teacher', teacher_code: teacherCode, password }
            : { loginType: 'student', schoolpay_code: schoolpayCode, password };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.');
        return;
      }

      if (data.role === 'admin') window.location.href = '/dashboard/admin';
      else if (data.role === 'bursar') window.location.href = '/dashboard/bursar';
      else if (data.role === 'teacher') window.location.href = '/dashboard/teacher';
      else if (data.role === 'student') window.location.href = '/dashboard/student';
      else setError('Unknown role. Contact administrator.');
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const title =
    role === 'admin' ? 'Admin Login' : role === 'teacher' ? 'Teacher Login' : 'Student Login';

  const idLabel =
    role === 'teacher' ? 'Teacher ID' : role === 'student' ? 'Student ID' : 'Email Address';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img
            src="/media/badge.png"
            alt="Kabukye Secondary School Badge"
            className="w-20 h-20 mx-auto mb-4 rounded-full object-contain"
          />
          <h1 className="text-2xl font-bold text-gray-900">Kabukye Secondary School</h1>
          <p className="text-gray-500 text-sm mt-1">School Management System</p>
          <div className="text-center mt-4">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-900 rounded-full text-sm font-medium">
              {title}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{idLabel}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#5c6bc0]"
              />
            </div>
          )}

          {role === 'teacher' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{idLabel}</label>
              <input
                type="text"
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
                placeholder="Enter your teacher ID"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#5c6bc0]"
              />
            </div>
          )}

          {role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{idLabel}</label>
              <input
                type="text"
                value={schoolpayCode}
                onChange={(e) => setSchoolpayCode(e.target.value)}
                placeholder="Enter your student ID"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#5c6bc0]"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#5c6bc0]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#1a237e] text-white rounded-lg px-6 py-3 font-medium hover:bg-[#283593] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
