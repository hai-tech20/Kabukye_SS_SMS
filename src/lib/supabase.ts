import { createClient } from '@supabase/supabase-js';
import { withRetry } from './retry';

export { withRetry };

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'sms'
    },
    global: {
      headers: {
        'Connection': 'keep-alive'
      },
      fetch: (url: RequestInfo | URL, init?: RequestInit) => {
        return fetch(url, {
          ...init,
          // Increase timeout to 30 seconds
          signal: AbortSignal.timeout(30000)
        });
      }
    },
    auth: {
      persistSession: false
    }
  }
);

export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: {
      schema: 'sms'
    },
    global: {
      headers: {
        'Connection': 'keep-alive'
      }
    }
  }
);

// Public schema client for website posts and applications (server-side only)
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    // No schema option = defaults to public schema
    global: {
      headers: {
        'Connection': 'keep-alive'
      },
      fetch: (url: RequestInfo | URL, init?: RequestInit) => {
        return fetch(url, {
          ...init,
          signal: AbortSignal.timeout(30000)
        });
      }
    },
    auth: {
      persistSession: false
    }
  }
);

// Cached fetch helper with stale-while-revalidate pattern
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export async function fetchWithCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 60000 // Default 1 minute cache
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);
  
  // Return fresh cache immediately
  if (cached && now - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  
  try {
    const data = await fn();
    cache.set(key, { data, timestamp: now, ttl: ttlMs });
    return data;
  } catch (error) {
    // If fetch fails but we have stale cache, return it
    if (cached) {
      console.log(`[fetchWithCache] Fetch failed, returning stale cache for key: ${key}`);
      return cached.data;
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
