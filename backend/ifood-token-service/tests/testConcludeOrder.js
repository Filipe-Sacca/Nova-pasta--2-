const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:8085';
const ORDER_ID = '140f9139-7174-4945-b964-daceb7e6c641';
const USER_ID = 'c1488646-aca8-4220-aacc-00e7ae3d6490';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testConcludeOrder() {
  console.log('🔍 Testando conclusão do pedido no iFood...');
  console.log('📦 Order ID:', ORDER_ID);
  console.log('');
  
  try {
    // 1. Primeiro verificar o status atual do pedido
    console.log('1️⃣ Verificando status atual do pedido...');
    const { data: orderData, error } = await supabase
      .from('ifood_orders')
      .select('*')
      .eq('ifood_order_id', ORDER_ID)
      .single();
    
    if (error || !orderData) {
      console.log('❌ Pedido não encontrado no banco de dados');
      return;
    }
    
    console.log('📋 Pedido encontrado:');
    console.log('   Status atual:', orderData.status);
    console.log('   Display ID:', orderData.display_id);
    console.log('   Merchant ID:', orderData.merchant_id);
    console.log('');
    
    // 2. Buscar o token de acesso
    console.log('2️⃣ Verificando token de acesso...');
    const { data: tokenData, error: tokenError } = await supabase
      .from('ifood_tokens')
      .select('*')
      .eq('user_id', USER_ID)
      .single();
    
    if (tokenError || !tokenData) {
      console.log('❌ Token não encontrado');
      return;
    }
    
    console.log('✅ Token encontrado e válido');
    console.log('');
    
    // 3. Testar chamada direta para a API do iFood
    console.log('3️⃣ Testando chamada direta para API do iFood...');
    console.log('   Endpoint: POST /order/v1.0/orders/' + ORDER_ID + '/conclude');
    
    try {
      const ifoodResponse = await axios({
        method: 'POST',
        url: `https://merchant-api.ifood.com.br/order/v1.0/orders/${ORDER_ID}/conclude`,
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        data: {}
      });
      
      console.log('✅ Resposta do iFood:');
      console.log('   Status:', ifoodResponse.status);
      console.log('   Data:', JSON.stringify(ifoodResponse.data, null, 2));
      
    } catch (ifoodError) {
      console.log('❌ Erro na chamada direta ao iFood:');
      console.log('   Status:', ifoodError.response?.status);
      console.log('   Erro:', ifoodError.response?.data || ifoodError.message);
      
      if (ifoodError.response?.status === 400) {
        console.log('');
        console.log('⚠️ ERRO 400 - Bad Request');
        console.log('Possíveis causas:');
        console.log('1. O pedido não está em status que permite conclusão');
        console.log('2. O pedido já foi concluído anteriormente');
        console.log('3. O pedido foi cancelado');
        console.log('4. Regra de negócio do iFood não permite conclusão neste momento');
      } else if (ifoodError.response?.status === 404) {
        console.log('');
        console.log('⚠️ ERRO 404 - Not Found');
        console.log('O pedido não foi encontrado no iFood');
        console.log('Isso pode significar que o pedido expirou ou foi removido');
      } else if (ifoodError.response?.status === 422) {
        console.log('');
        console.log('⚠️ ERRO 422 - Unprocessable Entity');
        console.log('O pedido não pode ser concluído devido ao seu estado atual');
        console.log('Verifique o status do pedido no painel do iFood');
      }
    }
    
    // 4. Verificar status do pedido no iFood
    console.log('');
    console.log('4️⃣ Verificando detalhes do pedido no iFood...');
    
    try {
      const detailsResponse = await axios({
        method: 'GET',
        url: `https://merchant-api.ifood.com.br/order/v1.0/orders/${ORDER_ID}`,
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📋 Detalhes do pedido no iFood:');
      console.log('   Status:', detailsResponse.data.status?.value || 'N/A');
      console.log('   Código:', detailsResponse.data.code || 'N/A');
      console.log('   Cliente:', detailsResponse.data.customer?.name || 'N/A');
      console.log('   Tipo de entrega:', detailsResponse.data.deliveryMethod?.mode || 'N/A');
      
      const currentStatus = detailsResponse.data.status?.value;
      console.log('');
      console.log('📊 Análise do status:');
      
      if (currentStatus === 'CONCLUDED' || currentStatus === 'DELIVERED') {
        console.log('✅ O pedido já está concluído no iFood!');
      } else if (currentStatus === 'DISPATCHED') {
        console.log('📦 O pedido está como DISPATCHED');
        console.log('   Deve ser possível concluir agora');
      } else if (currentStatus === 'CANCELLED') {
        console.log('❌ O pedido foi cancelado e não pode ser concluído');
      } else {
        console.log(`⚠️ Status atual: ${currentStatus}`);
        console.log('   Pode não ser possível concluir neste status');
      }
      
    } catch (detailsError) {
      console.log('❌ Erro ao buscar detalhes:', detailsError.response?.data || detailsError.message);
    }
    
    // 5. Verificar regras de negócio do iFood
    console.log('');
    console.log('📚 REGRAS DE NEGÓCIO DO IFOOD:');
    console.log('=====================================');
    console.log('Para concluir um pedido (conclude), ele deve estar:');
    console.log('1. Com status DISPATCHED (despachado)');
    console.log('2. Não pode estar cancelado');
    console.log('3. Não pode já estar concluído');
    console.log('4. Para entregas do iFood, o entregador deve confirmar a entrega');
    console.log('');
    console.log('⚠️ IMPORTANTE:');
    console.log('Se o pedido é entregue pelo iFood (não pela loja),');
    console.log('apenas o entregador pode marcar como concluído!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar
testConcludeOrder().catch(console.error);