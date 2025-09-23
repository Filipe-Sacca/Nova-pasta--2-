const axios = require('axios');

// Configurações
const API_BASE_URL = 'http://localhost:8085';
const ORDER_ID = '8789d16a-4d40-4f2f-8049-218c6f507362'; // O pedido que você tentou atualizar
const USER_ID = 'c1488646-aca8-4220-aacc-00e7ae3d6490'; // Seu user ID dos logs

async function testReadyForPickup() {
  console.log('🚀 Testando atualização de status READY_FOR_PICKUP...');
  console.log('📦 Order ID:', ORDER_ID);
  console.log('👤 User ID:', USER_ID);
  console.log('');
  
  try {
    // 1. Primeiro, vamos verificar o status atual do pedido
    console.log('1️⃣ Verificando status atual do pedido...');
    const currentOrderResponse = await axios.get(
      `${API_BASE_URL}/orders/completed?userId=${USER_ID}&limit=10`
    );
    
    const currentOrder = currentOrderResponse.data.orders?.find(o => o.ifood_order_id === ORDER_ID);
    if (currentOrder) {
      console.log('✅ Pedido encontrado no banco:');
      console.log('   Status atual:', currentOrder.status);
      console.log('   Display ID:', currentOrder.display_id);
      console.log('   Customer:', currentOrder.customer_name);
      console.log('');
    } else {
      console.log('⚠️ Pedido não encontrado na lista de pedidos');
      console.log('');
    }
    
    // 2. Tentar atualizar o status para READY_FOR_PICKUP
    console.log('2️⃣ Atualizando status para READY_FOR_PICKUP...');
    const updateResponse = await axios.put(
      `${API_BASE_URL}/orders/${ORDER_ID}/status`,
      {
        userId: USER_ID,
        status: 'READY_FOR_PICKUP'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('📥 Resposta do servidor:');
    console.log(JSON.stringify(updateResponse.data, null, 2));
    console.log('');
    
    // Verificar se a atualização foi enviada para o iFood
    if (updateResponse.data.data?.ifoodApiUpdated === false) {
      console.log('⚠️ AVISO: Status foi atualizado no banco local, mas NÃO foi enviado para o iFood!');
      console.log('   Possíveis causas:');
      console.log('   - Token expirado ou inválido');
      console.log('   - Problema de conectividade com a API do iFood');
      console.log('   - Pedido em estado que não permite esta mudança no iFood');
    } else if (updateResponse.data.success) {
      console.log('✅ Status atualizado com sucesso no banco e no iFood!');
    }
    
    // 3. Verificar o status após a atualização
    console.log('');
    console.log('3️⃣ Verificando status após atualização...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2 segundos
    
    const updatedOrderResponse = await axios.get(
      `${API_BASE_URL}/orders/completed?userId=${USER_ID}&limit=10`
    );
    
    const updatedOrder = updatedOrderResponse.data.orders?.find(o => o.ifood_order_id === ORDER_ID);
    if (updatedOrder) {
      console.log('✅ Status atual no banco:', updatedOrder.status);
      
      if (updatedOrder.status === 'READY_FOR_PICKUP') {
        console.log('✅ Status foi atualizado corretamente no banco!');
      } else {
        console.log('❌ Status não foi atualizado no banco');
      }
    }
    
    console.log('');
    console.log('📋 RESUMO DO TESTE:');
    console.log('-------------------');
    if (updateResponse.data.success) {
      console.log('✅ Atualização no banco local: SUCESSO');
      if (updateResponse.data.data?.ifoodApiUpdated === false) {
        console.log('❌ Sincronização com iFood: FALHOU');
        console.log('');
        console.log('🔧 AÇÃO RECOMENDADA:');
        console.log('1. Verificar se o token do iFood está válido');
        console.log('2. Verificar os logs do servidor para detalhes do erro');
        console.log('3. Tentar reautenticar com o iFood se necessário');
      } else {
        console.log('✅ Sincronização com iFood: SUCESSO');
      }
    } else {
      console.log('❌ Atualização falhou completamente');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.log('');
      console.log('⚠️ Pedido não encontrado. Verifique se o ID está correto.');
    } else if (error.response?.status === 400) {
      console.log('');
      console.log('⚠️ Erro de validação. Detalhes:', error.response.data);
    }
  }
}

// Executar o teste
testReadyForPickup().catch(console.error);