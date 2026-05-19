'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Student {
  id: string;
  full_name: string;
  class_id?: string;
  stream_id?: string;
  classes?: { name: string };
  streams?: { name: string };
  status?: string;
  // Add other student fields as needed
}

interface StudentsResponse {
  data: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface StudentsFilter {
  class_id?: string;
  stream_id?: string;
  subject_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Fetch students with filtering and pagination
async function fetchStudents(filters: StudentsFilter): Promise<StudentsResponse> {
  const params = new URLSearchParams();
  if (filters.class_id) params.set('class_id', filters.class_id);
  if (filters.stream_id) params.set('stream_id', filters.stream_id);
  if (filters.subject_id) params.set('subject_id', filters.subject_id);
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page || 1));
  params.set('limit', String(filters.limit || 100));
  
  const response = await fetch(`/api/students?${params.toString()}`, {
    headers: { 'Cache-Control': 'max-age=30' }
  });
  if (!response.ok) throw new Error('Failed to fetch students');
  return response.json();
}

// Hook for using students data
export function useStudents(filters: StudentsFilter = {}) {
  return useQuery({
    queryKey: ['students', filters],
    queryFn: () => fetchStudents(filters),
    staleTime: 30 * 1000, // 30 seconds for students (more dynamic)
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for adding a new student
export function useAddStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newStudent: Omit<Student, 'id'>) => {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent),
      });
      if (!response.ok) throw new Error('Failed to add student');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

// Hook for updating a student
export function useUpdateStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Student) => {
      const response = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update student');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

// Hook for deleting a student
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/students/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete student');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
