const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const sqlFilePath = path.join(__dirname, 'migrations', 'add_arabic_subject.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(❌ SQL file not found at: +""+${'$'}{sqlFilePath}+""+);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function executeMigration() {
  try {
    console.log('📝 Executing SQL migration: add_arabic_subject.sql');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      throw error;
    }

    console.log('✅ Migration executed successfully!');
    console.log('Arabic subjects have been added for S1, S2, S3, and S4');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:');
    console.error(err.message || err);
    process.exit(1);
  }
}

executeMigration();
