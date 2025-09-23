require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function getCurrentData() {
  console.log('🔍 Testando dados ATUAIS do iFood...\n');
  
  // 1. Buscar merchant e token atual
  const { data: merchants, error: merchantError } = await supabase
    .from('ifood_merchants')
    .select('merchant_id, user_id')
    .limit(1);
    
  if (merchantError || !merchants || merchants.length === 0) {
    console.error('❌ Erro ao buscar merchant:', merchantError?.message || 'Nenhum merchant encontrado');
    return;
  }
  
  const merchant = merchants[0];
  console.log(`🏪 Merchant: ${merchant.merchant_id}`);
  
  // 2. Buscar token ATUAL
  const { data: tokens, error: tokenError } = await supabase
    .from('ifood_tokens')
    .select('access_token')
    .eq('user_id', merchant.user_id)
    .limit(1);
    
  if (tokenError || !tokens || tokens.length === 0) {
    console.error('❌ Erro ao buscar token:', tokenError?.message || 'Nenhum token encontrado');
    return;
  }
  
  const accessToken = tokens[0].access_token;
  console.log(`🔑 Token atual: ${accessToken.substring(0, 20)}...`);
  
  // 3. Testar API call com token ATUAL
  const url = `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchant.merchant_id}/opening-hours`;
  console.log(`🌐 URL: ${url}\n`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Response ATUAL do iFood:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    const shifts = response.data.shifts || [];
    console.log(`\n📈 Total de dias configurados: ${shifts.length}`);
    
    if (shifts.length > 0) {
      console.log(`📅 Dias da semana:`);
      shifts.forEach((shift, index) => {
        console.log(`  ${index + 1}. ${shift.dayOfWeek}: ${shift.start} por ${shift.duration}min (ID: ${shift.id.substring(0, 8)}...)`);
      });
    }
    
    return { success: true, shifts };
    
  } catch (error) {
    console.error('❌ Erro na API call:', error.response?.status, error.response?.data || error.message);
    return { success: false, shifts: [] };
  }
}

getCurrentData().catch(console.error);