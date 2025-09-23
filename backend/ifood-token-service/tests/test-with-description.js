require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testWithDescription() {
  console.log('🧪 Teste FINAL com description obrigatória...\n');
  
  try {
    const { data: merchants } = await supabase
      .from('ifood_merchants')
      .select('merchant_id, user_id')
      .limit(1);
      
    const { data: tokens } = await supabase
      .from('ifood_tokens')
      .select('access_token')
      .eq('user_id', merchants[0].user_id)
      .limit(1);
      
    const merchantId = merchants[0].merchant_id;
    const accessToken = tokens[0].access_token;

    const body = {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      reason: 'Manutenção',
      description: 'Pausa para manutenção dos equipamentos'
    };

    console.log('📤 Body:', JSON.stringify(body, null, 2));

    const response = await axios.post(
      `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/interruptions`,
      body,
      {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log(`✅ Status: ${response.status}`);
    console.log('📥 Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testWithDescription();