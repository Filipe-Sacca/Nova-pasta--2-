require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Simular o método saveOpeningHoursToDatabase
async function saveOpeningHoursToDatabase(merchantId, shifts) {
  try {
    console.log(`💾 Salvando ${shifts.length} shifts para merchant ${merchantId}...`);
    
    // Create day mapping for quick access in future PUT operations
    const byDay = {};
    shifts.forEach(shift => {
      if (shift.id) {
        byDay[shift.dayOfWeek] = shift.id;
      }
    });

    const operatingHours = {
      shifts: shifts,
      by_day: byDay,
      last_updated: new Date().toISOString()
    };

    console.log('📊 Dados a serem salvos:', JSON.stringify(operatingHours, null, 2));

    const { error } = await supabase
      .from('ifood_merchants')
      .update({ operating_hours: operatingHours })
      .eq('merchant_id', merchantId);

    if (error) {
      console.error(`❌ Failed to save opening hours for ${merchantId}: ${error.message}`);
      return false;
    }

    console.log(`✅ Saved opening hours for merchant ${merchantId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving opening hours: ${error.message}`);
    return false;
  }
}

// Testar salvamento direto
async function testDirectSave() {
  console.log('🧪 Testando salvamento direto...\n');
  
  const merchantId = '577cb3b1-5845-4fbc-a219-8cd3939cb9ea';
  const shifts = [
    {
      "id": "4e6d94d6-9cbe-4622-b72c-4812ca4a9346",
      "dayOfWeek": "MONDAY",
      "start": "14:00:00",
      "duration": 60
    }
  ];
  
  const success = await saveOpeningHoursToDatabase(merchantId, shifts);
  
  if (success) {
    console.log('\n🎉 Salvamento direto FUNCIONOU!');
    
    // Verificar se salvou
    const { data, error } = await supabase
      .from('ifood_merchants')
      .select('operating_hours')
      .eq('merchant_id', merchantId)
      .single();
      
    if (error) {
      console.error('❌ Erro ao verificar:', error.message);
    } else {
      console.log('✅ Dados salvos no banco:', JSON.stringify(data.operating_hours, null, 2));
    }
  } else {
    console.log('\n❌ Salvamento direto FALHOU!');
  }
}

testDirectSave().catch(console.error);