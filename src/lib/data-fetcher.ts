import { supabaseAdmin, withRetry } from './supabase';

// Cached data store with TTL
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = CACHE_TTL
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

// Fast server-side teacher assignments fetch
export async function getTeacherAssignments(teacherId: string) {
  const cacheKey = `teacher_assignments_${teacherId}`;
  
  return fetchWithCache(cacheKey, async () => {
    const { data, error } = await withRetry(async () =>
      await supabaseAdmin
        .from('teacher_subjects')
        .select(`
          id,
          class_id,
          stream_id,
          subject_id,
          classes (id, name),
          streams (id, name),
          subjects (id, name, paper_count)
        `)
        .eq('teacher_id', teacherId)
    );
    
    if (error) throw error;
    return data || [];
  }, 60000); // 1 minute cache for assignments
}

// Fast server-side classes/streams/subjects fetch
export async function getClassesStreamsSubjects() {
  const cacheKey = 'classes_streams_subjects';
  
  return fetchWithCache(cacheKey, async () => {
    const [classesRes, streamsRes, subjectsRes] = await Promise.all([
      withRetry(async () => await supabaseAdmin.from('classes').select('*').order('name')),
      withRetry(async () => await supabaseAdmin.from('streams').select('*').order('name')),
      withRetry(async () => await supabaseAdmin.from('subjects').select('*').order('name'))
    ]);
    
    if (classesRes.error) throw classesRes.error;
    if (streamsRes.error) throw streamsRes.error;
    if (subjectsRes.error) throw subjectsRes.error;
    
    return {
      classes: classesRes.data || [],
      streams: streamsRes.data || [],
      subjects: subjectsRes.data || []
    };
  }, 300000); // 5 minute cache for reference data
}

// Fast server-side students fetch
export async function getStudents(
  classId?: string,
  streamId?: string,
  subjectId?: string
) {
  const cacheKey = `students_${classId}_${streamId}_${subjectId}`;
  
  return fetchWithCache(cacheKey, async () => {
    let query = supabaseAdmin
      .from('students')
      .select(`
        *,
        classes (name),
        streams (name)
      `)
      .eq('status', 'active');
    
    if (classId) query = query.eq('class_id', classId);
    if (streamId) query = query.eq('stream_id', streamId);
    
    const { data, error } = await withRetry(async () => await query.order('full_name'));
    if (error) throw error;
    return data || [];
  }, 30000);
}

// Clear cache for specific keys or all
export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
