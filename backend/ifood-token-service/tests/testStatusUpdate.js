require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStatusUpdate() {
  try {
    console.log('🧪 Testing status update with all column variations...\n');
    
    // Get an order with CONFIRMED status
    const { data: orders, error: fetchError } = await supabase
      .from('ifood_orders')
      .select('*')
      .eq('status', 'CONFIRMED')
      .limit(1);
    
    if (fetchError) {
      console.error('❌ Error fetching orders:', fetchError.message);
      return;
    }
    
    if (!orders || orders.length === 0) {
      console.log('⚠️  No CONFIRMED orders found. Let\'s try with any order:');
      
      const { data: anyOrders, error: anyError } = await supabase
        .from('ifood_orders')
        .select('*')
        .limit(1);
      
      if (anyError || !anyOrders || anyOrders.length === 0) {
        console.log('❌ No orders found in the database');
        return;
      }
      
      orders[0] = anyOrders[0];
    }
    
    const testOrder = orders[0];
    console.log(`📦 Testing with order ${testOrder.id}`);
    console.log(`Current status: ${testOrder.status}\n`);
    
    // Test 1: Try with previousStatus (camelCase)
    console.log('Test 1: Trying with previousStatus (camelCase)...');
    const { error: error1 } = await supabase
      .from('ifood_orders')
      .update({
        status: 'PREPARING',
        status_updated_at: new Date().toISOString(),
        status_updated_by: 'MERCHANT_ACTION',
        previousStatus: testOrder.status
      })
      .eq('id', testOrder.id);
    
    if (error1) {
      console.log(`❌ Failed with previousStatus: ${error1.message}`);
    } else {
      console.log('✅ Success with previousStatus!');
      return true;
    }
    
    // Test 2: Try with previous_status (snake_case)
    console.log('\nTest 2: Trying with previous_status (snake_case)...');
    const { error: error2 } = await supabase
      .from('ifood_orders')
      .update({
        status: 'PREPARING',
        status_updated_at: new Date().toISOString(),
        status_updated_by: 'MERCHANT_ACTION',
        previous_status: testOrder.status
      })
      .eq('id', testOrder.id);
    
    if (error2) {
      console.log(`❌ Failed with previous_status: ${error2.message}`);
    } else {
      console.log('✅ Success with previous_status!');
      return true;
    }
    
    // Test 3: Try without the previous status column at all
    console.log('\nTest 3: Trying without previous status column...');
    const { error: error3 } = await supabase
      .from('ifood_orders')
      .update({
        status: 'PREPARING',
        status_updated_at: new Date().toISOString(),
        status_updated_by: 'MERCHANT_ACTION'
      })
      .eq('id', testOrder.id);
    
    if (error3) {
      console.log(`❌ Failed without previous status: ${error3.message}`);
      
      // Test 4: Try minimal update
      console.log('\nTest 4: Trying minimal update (just status)...');
      const { error: error4 } = await supabase
        .from('ifood_orders')
        .update({
          status: 'PREPARING'
        })
        .eq('id', testOrder.id);
      
      if (error4) {
        console.log(`❌ Failed with minimal update: ${error4.message}`);
      } else {
        console.log('✅ Success with minimal update! (only status field)');
        console.log('\n⚠️  The status can be updated, but the tracking columns are not available.');
        console.log('This means the feature will work, but without history tracking.');
        return true;
      }
    } else {
      console.log('✅ Success without previous status column!');
      return true;
    }
    
    console.log('\n❌ All update attempts failed. Please check the database configuration.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testStatusUpdate().then(success => {
  if (success) {
    console.log('\n✅ Status update is working! Try the "Iniciar Preparo" button now.');
  }
});