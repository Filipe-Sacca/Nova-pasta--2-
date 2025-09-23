require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testCreateInterruption() {
  console.log('🧪 Testando POST create interruption...\n');

  try {
    // 1. Get merchant and user data
    const { data: merchants } = await supabase
      .from('ifood_merchants')
      .select('merchant_id, user_id, name')
      .limit(1);

    if (!merchants || merchants.length === 0) {
      console.error('❌ Nenhum merchant encontrado');
      return;
    }

    const merchant = merchants[0];
    console.log(`🏪 Merchant: ${merchant.merchant_id}`);
    console.log(`📛 Nome: ${merchant.name}`);
    console.log(`👤 User: ${merchant.user_id}`);

    // 2. Create a 2-hour pause starting now
    const startDate = new Date();
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 2); // 2 hours from now

    const interruptionData = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      reason: 'Manutenção programada',
      description: 'Pausa para limpeza e manutenção do equipamento',
      userId: merchant.user_id
    };

    console.log('📤 POST Request data:', JSON.stringify({
      startDate: interruptionData.startDate,
      endDate: interruptionData.endDate,
      reason: interruptionData.reason,
      description: interruptionData.description
    }, null, 2));

    // 3. Test POST request
    const response = await axios.post(
      `http://localhost:8081/merchants/${merchant.merchant_id}/interruptions`,
      interruptionData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Response Status: ${response.status}`);
    console.log('📥 Response Data:', JSON.stringify(response.data, null, 2));

    // 4. Test GET to list interruptions
    console.log('\n🔍 Testando GET list interruptions...');
    
    const listResponse = await axios.get(
      `http://localhost:8081/merchants/${merchant.merchant_id}/interruptions?userId=${merchant.user_id}`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ List Response Status: ${listResponse.status}`);
    console.log('📋 Active Interruptions:', JSON.stringify(listResponse.data, null, 2));

    // 5. If we got an interruption ID, test DELETE
    if (response.data.interruptionId) {
      console.log('\n🗑️ Testando DELETE interruption...');
      
      const deleteResponse = await axios.delete(
        `http://localhost:8081/merchants/${merchant.merchant_id}/interruptions/${response.data.interruptionId}`,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            userId: merchant.user_id
          }
        }
      );

      console.log(`✅ Delete Response Status: ${deleteResponse.status}`);
      console.log('🗑️ Delete Result:', JSON.stringify(deleteResponse.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error(`Status: ${error.response.status}`);
    }
  }
}

testCreateInterruption().catch(console.error);