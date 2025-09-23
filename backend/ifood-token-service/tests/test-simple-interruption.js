require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testSimpleInterruption() {
  console.log('🧪 Testando formato mais simples de interruption...\n');

  try {
    // Get merchant and token
    const { data: merchants } = await supabase
      .from('ifood_merchants')
      .select('merchant_id, user_id, name')
      .limit(1);

    const merchant = merchants[0];
    
    const { data: tokens } = await supabase
      .from('ifood_tokens')
      .select('access_token')
      .eq('user_id', merchant.user_id)
      .limit(1);
      
    const accessToken = tokens[0].access_token;

    console.log(`🏪 Merchant: ${merchant.merchant_id}`);
    console.log(`🔑 Token: ${accessToken.substring(0, 20)}...`);

    // Test different formats
    const formats = [
      {
        name: 'Formato 1 - start/end simples',
        body: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        name: 'Formato 2 - startDate/endDate',
        body: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        name: 'Formato 3 - startTime/endTime',
        body: {
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        name: 'Formato 4 - campos mínimos',
        body: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          reason: 'Teste'
        }
      }
    ];

    for (const format of formats) {
      console.log(`\n📤 Testando: ${format.name}`);
      console.log('Body:', JSON.stringify(format.body, null, 2));

      try {
        const response = await axios.post(
          `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchant.merchant_id}/interruptions`,
          format.body,
          {
            headers: {
              'accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        console.log(`✅ SUCESSO! Status: ${response.status}`);
        console.log('📥 Response:', JSON.stringify(response.data, null, 2));
        break; // Stop on first success

      } catch (error) {
        console.log(`❌ Falhou: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testSimpleInterruption().catch(console.error);