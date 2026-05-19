import { createClient } from '@supabase/supabase-js';

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

// Helper function for retry logic - handles various transient network errors
export async function withRetry<T>(
  fn: () => PromiseLike<T> | T,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await Promise.resolve(fn());
  } catch (error: any) {
    const errorMessage = error?.message?.toLowerCase?.() || String(error).toLowerCase();
    
    // Check for retryable errors
    const isRetryable = 
      retries > 0 && (
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('connect timeout') ||
        errorMessage.includes('und_err_connect_timeout') ||
        errorMessage.includes('networkerror') ||
        errorMessage.includes('network error') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('etimedout') ||
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('connection reset') ||
        errorMessage.includes('connection refused') ||
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'UND_ERR_CONNECT_TIMEOUT'
      );
    
    if (!isRetryable) {
      throw error;
    }
    
    console.log(`[withRetry] Retrying after ${delay}ms... (${retries} attempts left). Error: ${errorMessage.substring(0, 100)}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 1.5); // Less aggressive backoff
  }
}

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
