import { createClient } from '@supabase/supabase-js';

// Public schema client for website posts and applications (client-safe)
// This file is safe to import in client components
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    // No schema option = defaults to public schema
    global: {
      headers: {
        'Connection': 'keep-alive'
      }
    }
  }
);
