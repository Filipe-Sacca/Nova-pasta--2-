// Test interruptions endpoints with simple test
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function getTokenForUser(userId) {
  const { data, error } = await supabase
    .from('ifood_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .limit(1);
    
  if (error || !data || data.length === 0) {
    return null;
  }
  
  return { access_token: data[0].access_token };
}

async function testInterruptionsEndpoints() {
  console.log('🧪 Testando Endpoints de Pausa Programada...\n');

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

    // 2. Get access token
    const tokenData = await getTokenForUser(merchant.user_id);
    if (!tokenData) {
      console.error('❌ Token não encontrado');
      return;
    }

    console.log(`🔑 Token: ${tokenData.access_token.substring(0, 20)}...`);

    // 3. Test POST - Create interruption
    console.log('\n📤 TESTE 1: POST Create Interruption');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 2); // 2 hours from now

    const createData = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      reason: 'Manutenção programada',
      description: 'Teste de pausa programada via API'
    };

    console.log('Data enviada:', {
      startDate: createData.startDate,
      endDate: createData.endDate,
      reason: createData.reason
    });

    // Direct API call to iFood
    const createResponse = await axios.post(
      `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchant.merchant_id}/interruptions`,
      createData,
      {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );

    console.log(`✅ CREATE Status: ${createResponse.status}`);
    console.log('📥 CREATE Response:', JSON.stringify(createResponse.data, null, 2));

    const interruptionId = createResponse.data?.id || createResponse.data?.interruptionId;

    // 4. Test GET - List interruptions
    console.log('\n📋 TESTE 2: GET List Interruptions');
    
    const listResponse = await axios.get(
      `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchant.merchant_id}/interruptions`,
      {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );

    console.log(`✅ LIST Status: ${listResponse.status}`);
    console.log('📋 LIST Response:', JSON.stringify(listResponse.data, null, 2));

    // 5. Test DELETE if we have an ID
    if (interruptionId) {
      console.log('\n🗑️ TESTE 3: DELETE Remove Interruption');
      console.log(`ID para deletar: ${interruptionId}`);
      
      const deleteResponse = await axios.delete(
        `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchant.merchant_id}/interruptions/${interruptionId}`,
        {
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        }
      );

      console.log(`✅ DELETE Status: ${deleteResponse.status}`);
      console.log('🗑️ DELETE Response:', JSON.stringify(deleteResponse.data, null, 2));
    } else {
      console.log('\n⚠️ Sem ID para testar DELETE');
    }

    console.log('\n🎉 Todos os testes de interrupção concluídos!');

  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Headers:`, error.response.headers);
    }
  }
}

testInterruptionsEndpoints().catch(console.error);