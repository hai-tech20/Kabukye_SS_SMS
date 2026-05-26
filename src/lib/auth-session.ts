import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

export type UserRole = 'admin' | 'bursar' | 'teacher' | 'student';

export type SessionPayload = {
  id: string;
  role: UserRole | string;
  full_name?: string;
};

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('sms_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireSession(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized('Not authenticated');
  return session;
}

export async function requireRoles(
  allowed: Array<UserRole | string>
): Promise<SessionPayload | NextResponse> {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  if (!allowed.includes(session.role)) {
    return forbidden('You do not have permission to perform this action');
  }
  return session;
}

/** Admin-only (not bursar/teacher/student). */
export async function requireAdminSession(): Promise<SessionPayload | NextResponse> {
  return requireRoles(['admin']);
}

/** Admin or bursar. */
export async function requireAdminOrBursar(): Promise<SessionPayload | NextResponse> {
  return requireRoles(['admin', 'bursar']);
}

export async function requireTeacherOrAdmin(): Promise<SessionPayload | NextResponse> {
  return requireRoles(['admin', 'teacher']);
}

export async function requireStaff(): Promise<SessionPayload | NextResponse> {
  return requireRoles(['admin', 'bursar', 'teacher']);
}

/** Students may only access their own record unless staff. */
export function assertStudentSelf(
  session: SessionPayload,
  studentId: string
): NextResponse | null {
  if (session.role === 'student' && session.id !== studentId) {
    return forbidden('You can only access your own records');
  }
  return null;
}

export function validateScore(score: unknown): string | null {
  const n = Number(score);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    return 'Score must be between 0 and 100';
  }
  return null;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function validateImageFile(file: File | null | undefined): string | null {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES) return 'File must be under 2MB';
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG and WebP images allowed';
  }
  return null;
}

export function sanitizeSearchInput(input: string | null): string | null {
  if (!input) return null;
  return input.replace(/[%_\\]/g, '').slice(0, 100);
}
