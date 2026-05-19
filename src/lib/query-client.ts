'use client';

import { QueryClient, Query } from '@tanstack/react-query';

// Create a client with optimal caching settings for slow connections
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes (reduces refetches)
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes even when not used
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch on window focus (saves bandwidth)
      refetchOnWindowFocus: false,
      // Don't refetch when reconnecting (we have stale data)
      refetchOnReconnect: false,
      // Enable placeholder data for instant UI
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Helper to prefetch data for a route
export function prefetchQuery<T>(key: string[], fetcher: () => Promise<T>) {
  return queryClient.prefetchQuery({
    queryKey: key,
    queryFn: fetcher,
    staleTime: 5 * 60 * 1000,
  });
}

// Helper to invalidate related queries after mutations
export function invalidateQueries(pattern: string) {
  return queryClient.invalidateQueries({
    predicate: (query: Query) => query.queryKey.some((key) => String(key).includes(pattern)),
  });
}
