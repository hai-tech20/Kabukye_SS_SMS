import { getSession } from '@/lib/auth-session';
import { getTeacherAssignments, getClassesStreamsSubjects } from '@/lib/data-fetcher';
import MarksEntryClient from '@/app/dashboard/teacher/marks/MarksEntryClient';
import AdminSidebar from '@/components/sidebar/AdminSidebar';

export default async function AdminMarksEntryPage() {
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
    error = e.message || 'Failed to load data';
  }
  
  return (
    <MarksEntryClient 
      initialAssignments={assignments}
      initialClasses={classes}
      initialStreams={streams}
      initialSubjects={subjects}
      teacherId={session?.id || ''}
      error={error}
      SidebarComponent={AdminSidebar}
    />
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
