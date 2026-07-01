import { createClient } from '@supabase/supabase-js';
import { withRetry } from './retry';

export { withRetry };

// Placeholders allow `next build` in Docker when runtime secrets are not injected yet.
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIn0.placeholder-service-role-key';
const PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIn0.placeholder-anon-key';

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || PLACEHOLDER_SERVICE_KEY;
}

function getAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_ANON_KEY;
}

const sharedFetch = (url: RequestInfo | URL, init?: RequestInit) =>
  fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30000),
  });

export const supabaseAdmin = createClient(
  getSupabaseUrl(),
  getServiceRoleKey(),
  {
    db: { schema: 'sms' },
    global: {
      headers: { Connection: 'keep-alive' },
      fetch: sharedFetch,
    },
    auth: { persistSession: false },
  }
);

export const supabaseBrowser = createClient(
  getSupabaseUrl(),
  getAnonKey(),
  {
    db: { schema: 'sms' },
    global: {
      headers: { Connection: 'keep-alive' },
    },
  }
);

// Public schema client for website posts and applications (server-side only)
export const supabasePublic = createClient(
  getSupabaseUrl(),
  getServiceRoleKey(),
  {
    global: {
      headers: { Connection: 'keep-alive' },
      fetch: sharedFetch,
    },
    auth: { persistSession: false },
  }
);

// Cached fetch helper with stale-while-revalidate pattern
const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

export async function fetchWithCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 60000
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }

  try {
    const data = await fn();
    cache.set(key, { data, timestamp: now, ttl: ttlMs });
    return data;
  } catch (error) {
    if (cached) {
      console.log(`[fetchWithCache] Fetch failed, returning stale cache for key: ${key}`);
      return cached.data as T;
    }
    throw error;
  }
}

export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
