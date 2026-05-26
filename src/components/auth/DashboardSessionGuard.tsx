'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function loginPathForPath(pathname: string): string {
  if (pathname.startsWith('/dashboard/teacher')) return '/login/teacher';
  if (pathname.startsWith('/dashboard/student')) return '/login/student';
  if (pathname.startsWith('/dashboard/bursar')) return '/login/admin';
  return '/login/admin';
}

/** Re-validates session on load and when returning via browser back (bfcache). */
export default function DashboardSessionGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          window.location.replace(loginPathForPath(pathname));
        }
      } catch {
        window.location.replace(loginPathForPath(pathname));
      }
    };

    verify();

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) verify();
    };

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [pathname]);

  return null;
}
