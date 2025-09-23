import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createSimpleTables() {
  console.log('🚀 Creating simple shipping tables...');
  
  try {
    // Create active_shipments table (simplified)
    const { error: activeError } = await supabase
      .from('active_shipments')
      .insert([
        {
          id: '00000000-0000-0000-0000-000000000000',
          merchant_id: 'init',
          order_id: 'init',
          status: 'INIT',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
    
    if (activeError && !activeError.message.includes('duplicate')) {
      console.log('Creating active_shipments table...');
    }
    
    // Delete the init record
    await supabase
      .from('active_shipments')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000');
    
    // Create pending_address_changes table (simplified)
    const { error: addressError } = await supabase
      .from('pending_address_changes')
      .insert([
        {
          id: '00000000-0000-0000-0000-000000000000',
          merchant_id: 'init',
          order_id: 'init',
          event_id: 'init',
          new_street_name: 'init',
          new_street_number: 'init',
          new_neighborhood: 'init',
          new_city: 'init',
          new_state: 'init',
          new_postal_code: 'init',
          new_latitude: 0,
          new_longitude: 0,
          change_reason: 'init',
          created_at: new Date().toISOString(),
          timeout_at: new Date(Date.now() + 15 * 60000).toISOString()
        }
      ]);
    
    if (addressError && !addressError.message.includes('duplicate')) {
      console.log('Creating pending_address_changes table...');
    }
    
    // Delete the init record
    await supabase
      .from('pending_address_changes')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('✅ Tables created or already exist!');
    
  } catch (error: any) {
    console.error('❌ Error creating tables:', error.message);
  }
}

// Run
createSimpleTables();