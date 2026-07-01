import { createClient } from '@supabase/supabase-js';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIn0.placeholder-anon-key';

// Public schema client for website posts and applications (client-safe)
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_ANON_KEY,
  {
    global: {
      headers: {
        Connection: 'keep-alive',
      },
    },
  }
);
