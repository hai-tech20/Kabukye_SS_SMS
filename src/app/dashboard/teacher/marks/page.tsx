import { getSession } from '@/lib/auth-session';
import { getTeacherAssignments, getClassesStreamsSubjects } from '@/lib/data-fetcher';
import MarksEntryClient from './MarksEntryClient';

// Server Component - fetches data BEFORE sending to client (FASTEST method)
export default async function MarksEntryPage() {
  const session = await getSession();
  
  let assignments: any[] = [];
  let classes: any[] = [];
  let streams: any[] = [];
  let subjects: any[] = [];
  let error: string | null = null;
  
  try {
    if (session?.id) {
      const [assignmentsData, referenceData] = await Promise.all([
        getTeacherAssignments(session.id),
        getClassesStreamsSubjects()
      ]);
      
      assignments = assignmentsData;
      classes = referenceData.classes;
      streams = referenceData.streams;
      subjects = referenceData.subjects;
    } else {
      error = 'Not authenticated';
    }
  } catch (e: any) {
    console.error('Error pre-fetching data:', e);
    error = e.message || 'Failed to load teacher data';
  }
  
  return (
    <MarksEntryClient 
      initialAssignments={assignments}
      initialClasses={classes}
      initialStreams={streams}
      initialSubjects={subjects}
      teacherId={session?.id || ''}
      error={error}
    />
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
