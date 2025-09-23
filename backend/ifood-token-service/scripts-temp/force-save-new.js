require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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

    console.log(`📊 Salvando ${Object.keys(byDay).length} dias:`, Object.keys(byDay).join(', '));

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

async function forceUpdateWith7Days() {
  console.log('🔄 Forçando salvamento dos 7 dias atuais...\n');
  
  // 1. Buscar dados atuais do iFood
  const { data: merchants } = await supabase
    .from('ifood_merchants')
    .select('merchant_id, user_id')
    .limit(1);
    
  const merchant = merchants[0];
  
  const { data: tokens } = await supabase
    .from('ifood_tokens')
    .select('access_token')
    .eq('user_id', merchant.user_id)
    .limit(1);
    
  const accessToken = tokens[0].access_token;
  
  // 2. Buscar horários atuais do iFood
  const url = `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchant.merchant_id}/opening-hours`;
  
  const response = await axios.get(url, {
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const shifts = response.data.shifts || [];
  console.log(`📊 iFood retornou ${shifts.length} dias`);
  
  // 3. Forçar salvamento
  const success = await saveOpeningHoursToDatabase(merchant.merchant_id, shifts);
  
  if (success) {
    console.log('\n🎉 Dados atualizados com sucesso!');
    
    // 4. Verificar se salvou
    const { data } = await supabase
      .from('ifood_merchants')
      .select('operating_hours')
      .eq('merchant_id', merchant.merchant_id)
      .single();
      
    console.log('\n✅ Dados no banco:');
    console.log(`   Shifts: ${data.operating_hours.shifts.length} dias`);
    console.log(`   By_day: ${Object.keys(data.operating_hours.by_day).length} dias`);
    console.log(`   Dias: ${Object.keys(data.operating_hours.by_day).join(', ')}`);
  }
}

forceUpdateWith7Days().catch(console.error);