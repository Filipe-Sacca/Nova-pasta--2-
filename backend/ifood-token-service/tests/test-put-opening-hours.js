require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testPutOpeningHours() {
  console.log('🧪 Testando PUT opening-hours...\n');

  try {
    // 1. Get merchant and user data
    const { data: merchants } = await supabase
      .from('ifood_merchants')
      .select('merchant_id, user_id')
      .limit(1);

    if (!merchants || merchants.length === 0) {
      console.error('❌ Nenhum merchant encontrado');
      return;
    }

    const merchant = merchants[0];
    console.log(`🏪 Merchant: ${merchant.merchant_id}`);
    console.log(`👤 User: ${merchant.user_id}`);

    // 2. Test PUT request
    const putData = {
      dayOfWeek: 'MONDAY',
      startTime: '08:00:00',
      endTime: '18:00:00',
      userId: merchant.user_id
    };

    console.log('📤 PUT Request data:', JSON.stringify(putData, null, 2));

    const response = await axios.put(
      `http://localhost:8082/merchants/${merchant.merchant_id}/opening-hours`,
      putData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Response Status: ${response.status}`);
    console.log('📥 Response Data:', JSON.stringify(response.data, null, 2));

    // 3. Wait and check if iFood API was updated
    console.log('\n⏳ Aguardando 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Verify with direct iFood API call
    const { data: tokens } = await supabase
      .from('ifood_tokens')
      .select('access_token')
      .eq('user_id', merchant.user_id)
      .limit(1);

    if (tokens && tokens.length > 0) {
      const accessToken = tokens[0].access_token;
      
      const verifyResponse = await axios.get(
        `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchant.merchant_id}/opening-hours`,
        {
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      console.log('\n🔍 Verification - iFood API atual:');
      console.log('📊 Monday shift:', verifyResponse.data.shifts.find(s => s.dayOfWeek === 'MONDAY'));
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error(`Status: ${error.response.status}`);
    }
  }
}

testPutOpeningHours().catch(console.error);