import { cookies } from 'next/headers';
import { getTeacherAssignments, getClassesStreamsSubjects } from '@/lib/data-fetcher';
import { getSession } from '@/lib/auth-session';
import MarksEntryClient from './MarksEntryClient';

// Server Component - fetches data BEFORE sending to client
export default async function MarksEntryPageWrapper() {
  // Get session server-side (fast, no network call)
  const session = await getSession();
  
  let assignments: any[] = [];
  let classesData: { classes: any[]; streams: any[]; subjects: any[] } = { classes: [], streams: [], subjects: [] };
  let error: string | null = null;
  
  try {
    // Fetch data in parallel with aggressive caching
    if (session?.id) {
      [assignments, classesData] = await Promise.all([
        getTeacherAssignments(session.id),
        getClassesStreamsSubjects()
      ]);
    }
  } catch (e: any) {
    console.error('Error pre-fetching data:', e);
    error = e.message;
  }
  
  // Pass pre-fetched data to client component
  return (
    <MarksEntryClient 
      initialAssignments={assignments}
      initialClasses={classesData.classes}
      initialStreams={classesData.streams}
      initialSubjects={classesData.subjects}
      teacherId={session?.id || ''}
      error={error}
    />
  );
}
