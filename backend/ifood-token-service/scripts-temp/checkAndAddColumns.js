require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  try {
    console.log('🔍 Checking if columns already exist...');
    
    // Try to select the columns
    const { data, error } = await supabase
      .from('ifood_orders')
      .select('id, status, status_updated_at, status_updated_by, previousStatus')
      .limit(1);
    
    if (error) {
      if (error.message.includes('status_updated_at') || 
          error.message.includes('status_updated_by') || 
          error.message.includes('previousStatus')) {
        console.log('❌ One or more columns are missing');
        console.log('Error details:', error.message);
        
        console.log('\n📋 To fix this issue, please execute the following SQL in your Supabase dashboard:');
        console.log('\n1. Go to: https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Click on "SQL Editor" in the left sidebar');
        console.log('4. Paste and run this SQL:\n');
        console.log('-----------------------------------------------------------');
        console.log(`-- Add status tracking columns to ifood_orders table
ALTER TABLE ifood_orders 
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS status_updated_by TEXT,
ADD COLUMN IF NOT EXISTS previousStatus TEXT;`);
        console.log('-----------------------------------------------------------');
        console.log('\n5. Click "Run" to execute the SQL');
        console.log('6. Once completed, try the "Iniciar Preparo" button again\n');
        
        return false;
      } else {
        console.error('❌ Different error:', error.message);
        return false;
      }
    }
    
    console.log('✅ All columns exist! The status update feature should work now.');
    console.log('Columns found:', Object.keys(data?.[0] || {}));
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Also let's test if we can update a status
async function testStatusUpdate() {
  try {
    console.log('\n🧪 Testing status update capability...');
    
    // Get an order to test with
    const { data: orders, error: fetchError } = await supabase
      .from('ifood_orders')
      .select('id, status')
      .limit(1);
    
    if (fetchError || !orders || orders.length === 0) {
      console.log('⚠️  No orders found to test with');
      return;
    }
    
    const testOrder = orders[0];
    console.log(`Testing with order ${testOrder.id} (current status: ${testOrder.status})`);
    
    // Try to update with the new columns
    const { error: updateError } = await supabase
      .from('ifood_orders')
      .update({
        status: testOrder.status, // Keep same status
        status_updated_at: new Date().toISOString(),
        status_updated_by: 'SYSTEM_TEST',
        previousStatus: testOrder.status
      })
      .eq('id', testOrder.id);
    
    if (updateError) {
      console.log('❌ Status update test failed:', updateError.message);
      
      if (updateError.message.includes('column')) {
        console.log('\n⚠️  The columns are missing from the database.');
        console.log('Please execute the SQL shown above in your Supabase dashboard.');
      }
    } else {
      console.log('✅ Status update test successful! The feature is ready to use.');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

async function main() {
  const columnsExist = await checkColumns();
  
  if (columnsExist) {
    await testStatusUpdate();
    console.log('\n✅ Everything is ready! You can now use the "Iniciar Preparo" button.');
  } else {
    console.log('\n⚠️  Please follow the instructions above to add the missing columns.');
  }
}

main();