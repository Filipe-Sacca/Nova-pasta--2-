const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🔄 Running migration to fix column sizes...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'fix_order_columns_size.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sql 
    }).single();
    
    if (error) {
      // If RPC doesn't exist, try direct execution with individual statements
      console.log('⚠️ RPC exec_sql not available, trying alternative method...');
      
      // Split SQL into individual statements
      const statements = [
        `ALTER TABLE ifood_orders ALTER COLUMN ifood_order_id TYPE VARCHAR(255)`,
        `ALTER TABLE ifood_orders ALTER COLUMN merchant_id TYPE VARCHAR(255)`,
        `ALTER TABLE ifood_orders ALTER COLUMN customer_name TYPE VARCHAR(255)`,
        `ALTER TABLE ifood_orders ALTER COLUMN customer_phone TYPE VARCHAR(100)`,
        `ALTER TABLE ifood_orders ALTER COLUMN payment_method TYPE VARCHAR(100)`
      ];
      
      for (const stmt of statements) {
        console.log(`Executing: ${stmt.substring(0, 50)}...`);
        // Note: Supabase JS client doesn't support direct ALTER TABLE
        // We need to use the Dashboard SQL editor or psql directly
      }
      
      console.log('\n📋 Migration SQL generated successfully!');
      console.log('⚠️ Please run the following SQL in your Supabase Dashboard SQL Editor:');
      console.log('----------------------------------------');
      console.log(sql);
      console.log('----------------------------------------');
      console.log('\n🔗 Go to: https://supabase.com/dashboard/project/_/sql');
      
    } else {
      console.log('✅ Migration executed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error running migration:', error);
  }
}

runMigration();