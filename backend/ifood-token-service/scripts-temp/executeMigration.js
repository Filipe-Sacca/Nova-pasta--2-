require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeMigration() {
  try {
    console.log('🔄 Executing migration to add status columns...');
    
    // Execute the SQL directly using Supabase's rpc or direct SQL execution
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE ifood_orders 
        ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS status_updated_by TEXT,
        ADD COLUMN IF NOT EXISTS previousStatus TEXT;
      `
    }).catch(async () => {
      // If RPC doesn't exist, try direct SQL through the REST API
      const { error: alterError } = await supabase.from('ifood_orders').select('*').limit(0);
      
      if (!alterError) {
        // Check if columns already exist by trying to select them
        const { data, error: checkError } = await supabase
          .from('ifood_orders')
          .select('status_updated_at, status_updated_by, previousStatus')
          .limit(1);
        
        if (checkError && checkError.message.includes('column')) {
          console.log('❌ Columns do not exist and cannot be added via this method.');
          console.log('Please run the following SQL in your Supabase dashboard:');
          console.log(`
ALTER TABLE ifood_orders 
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS status_updated_by TEXT,
ADD COLUMN IF NOT EXISTS previousStatus TEXT;
          `);
          return false;
        } else if (!checkError) {
          console.log('✅ Columns already exist or were successfully added');
          return true;
        }
      }
      
      return false;
    });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      return false;
    }

    console.log('✅ Migration executed successfully');
    
    // Verify the columns exist
    const { data, error: verifyError } = await supabase
      .from('ifood_orders')
      .select('id, status_updated_at, status_updated_by, previousStatus')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      console.log('\n⚠️  Please run the following SQL directly in your Supabase dashboard:');
      console.log('-----------------------------------------------------------');
      console.log(`ALTER TABLE ifood_orders 
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS status_updated_by TEXT,
ADD COLUMN IF NOT EXISTS previousStatus TEXT;`);
      console.log('-----------------------------------------------------------');
      return false;
    }
    
    console.log('✅ Columns verified successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.log('\n⚠️  Please run the following SQL directly in your Supabase dashboard:');
    console.log('-----------------------------------------------------------');
    console.log(`ALTER TABLE ifood_orders 
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS status_updated_by TEXT,
ADD COLUMN IF NOT EXISTS previousStatus TEXT;`);
    console.log('-----------------------------------------------------------');
    return false;
  }
}

executeMigration().then(success => {
  if (success) {
    console.log('\n✅ Migration completed. You can now use the status update feature.');
  } else {
    console.log('\n⚠️  Migration could not be completed automatically.');
    console.log('Please execute the SQL shown above in your Supabase dashboard.');
  }
  process.exit(success ? 0 : 1);
});