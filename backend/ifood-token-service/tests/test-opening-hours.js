require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testOpeningHours() {
  console.log('🔍 Testando fetchOpeningHours diretamente...\n');
  
  // 1. Buscar merchant e token
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
  
  // 2. Buscar token
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
  console.log(`🔑 Token encontrado: ${accessToken.substring(0, 20)}...`);
  
  // 3. Testar API call diretamente
  const url = `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchant.merchant_id}/opening-hours`;
  console.log(`🌐 URL: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Response data:`, JSON.stringify(response.data, null, 2));
    
    // 4. Processar como no código
    const data = response.data;
    let hours = [];
    
    if (data.shifts) {
      hours = data.shifts;
      console.log(`✅ Encontrou shifts: ${hours.length} itens`);
    } else if (data.periods) {
      hours = data.periods;
      console.log(`✅ Encontrou periods: ${hours.length} itens`);
    } else if (Array.isArray(data)) {
      hours = data;
      console.log(`✅ Array direto: ${hours.length} itens`);
    } else {
      console.log(`❌ Formato desconhecido:`, Object.keys(data));
    }
    
    if (hours.length > 0) {
      console.log(`📋 Primeiro item:`, JSON.stringify(hours[0], null, 2));
    }
    
    return { success: true, hours };
    
  } catch (error) {
    console.error('❌ Erro na API call:', error.response?.status, error.response?.data || error.message);
    return { success: false, hours: [] };
  }
}

testOpeningHours().catch(console.error);