import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const createClient = () => {
  // Use service role key for admin operations, fallback to anon key for testing
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!serviceRoleKey) {
    console.error('No Supabase service role key found. Please check your .env.local file');
  }

  const key = serviceRoleKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      db: {
        schema: 'sms'
      }
    }
  );
};
