import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import RoleLoginPage from '@/components/auth/RoleLoginPage';

type Role = 'admin' | 'teacher' | 'student';

export default function RoleLoginRoute({ params }: { params: { role: string } }) {
  const role = params.role as Role;

  if (!['admin', 'teacher', 'student'].includes(role)) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RoleLoginPage role={role} />
    </Suspense>
  );
}
