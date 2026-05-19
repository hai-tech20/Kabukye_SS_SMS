import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    console.log('Fixing teacher subject assignments...');
    
    // Fix a-phys-s6 assigned to s5 → should be a-phys-s5
    const { data: physData, error: physError } = await supabaseAdmin
      .from('sms.teacher_subjects')
      .update({ subject_id: 'a-phys-s5' })
      .eq('class_id', 's5')
      .eq('subject_id', 'a-phys-s6')
      .select();
    
    if (physError) {
      console.error('Error fixing Physics assignments:', physError);
    } else {
      console.log(`Fixed ${physData?.length || 0} Physics assignments`);
    }
    
    // Fix a-bio-s6 assigned to s5 → should be a-bio-s5
    const { data: bioData, error: bioError } = await supabaseAdmin
      .from('sms.teacher_subjects')
      .update({ subject_id: 'a-bio-s5' })
      .eq('class_id', 's5')
      .eq('subject_id', 'a-bio-s6')
      .select();
    
    if (bioError) {
      console.error('Error fixing Biology assignments:', bioError);
    } else {
      console.log(`Fixed ${bioData?.length || 0} Biology assignments`);
    }
    
    // Check for any other mismatches
    const { data: mismatches, error: mismatchError } = await supabaseAdmin
      .from('sms.teacher_subjects')
      .select('*');
    
    if (mismatchError) {
      console.error('Error checking mismatches:', mismatchError);
    } else {
      const s5Mismatches = mismatches?.filter(m => m.class_id === 's5' && !m.subject_id.includes('-s5')) || [];
      const s6Mismatches = mismatches?.filter(m => m.class_id === 's6' && !m.subject_id.includes('-s6')) || [];
      console.log(`Found ${s5Mismatches.length} S5 mismatches, ${s6Mismatches.length} S6 mismatches`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Teacher assignments fixed',
      physicsFixed: physData?.length || 0,
      biologyFixed: bioData?.length || 0
    });
    
  } catch (error) {
    console.error('Error fixing assignments:', error);
    return NextResponse.json({ 
      error: 'Failed to fix assignments',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
