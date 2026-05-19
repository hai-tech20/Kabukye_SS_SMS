'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ClassesData {
  data: {
    classes: Array<{
      id: string;
      name: string;
      level?: string;
      next_class_id?: string | null;
      academic_year?: string;
      student_count?: number;
    }>;
    streams: Array<{
      id: string;
      name: string;
      class_id: string;
      student_count?: number;
    }>;
    subjects: Array<{
      id: string;
      name: string;
      class_id?: string;
      code?: string;
      paper_count?: number;
      is_core?: boolean;
      is_a_level?: boolean;
    }>;
    currentAcademicYear: number;
    currentTerm: string;
    termDays: number;
  };
}

// Fetch classes data with caching
async function fetchClasses(): Promise<ClassesData> {
  const response = await fetch('/api/classes', {
    headers: { 'Cache-Control': 'max-age=30' }
  });
  if (!response.ok) throw new Error('Failed to fetch classes');
  return response.json();
}

// Hook for using classes data with automatic caching
export function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook for adding a new class
export function useAddClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newClass: { name: string }) => {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClass),
      });
      if (!response.ok) throw new Error('Failed to add class');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch classes after adding
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}
