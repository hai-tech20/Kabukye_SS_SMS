import { notFound } from 'next/navigation';
import RoleLoginPage from '@/components/auth/RoleLoginPage';

type Role = 'admin' | 'teacher' | 'student';

export default function RoleLoginRoute({ params }: { params: { role: string } }) {
  const role = params.role as Role;

  if (!['admin', 'teacher', 'student'].includes(role)) {
    notFound();
  }

  return <RoleLoginPage role={role} />;
}
