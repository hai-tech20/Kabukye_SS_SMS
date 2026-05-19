import { createClient } from './client';

export const testConnection = async () => {
  const supabase = createClient();
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('academic_years')
      .select('count')
      .single();
    
    console.log('Supabase connection test:', { data, error });
    
    if (error) {
      console.error('Supabase connection error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, count: data?.count || 0 };
  } catch (err: any) {
    console.error('Supabase test error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
};
