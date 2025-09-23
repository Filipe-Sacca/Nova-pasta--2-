const axios = require('axios');

const API_BASE_URL = 'http://localhost:8085';
const USER_ID = 'c1488646-aca8-4220-aacc-00e7ae3d6490';
const MERCHANT_ID = '577cb3b1-5845-4fbc-a219-8cd3939cb9ea';

async function testRealIfoodOrders() {
  console.log('🔍 Buscando pedidos REAIS do iFood...');
  console.log('');
  
  try {
    // 1. Primeiro, vamos buscar pedidos diretamente da API do iFood via polling
    console.log('1️⃣ Iniciando polling do iFood para buscar pedidos reais...');
    const pollingResponse = await axios.post(
      `${API_BASE_URL}/orders/polling/start`,
      {
        userId: USER_ID,
        merchantIds: [MERCHANT_ID]
      }
    );
    
    console.log('📥 Resposta do polling:', pollingResponse.data);
    
    // Aguardar um pouco para o polling processar
    console.log('⏳ Aguardando 5 segundos para o polling processar...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 2. Agora buscar os pedidos que vieram do iFood
    console.log('');
    console.log('2️⃣ Buscando pedidos do merchant...');
    const ordersResponse = await axios.get(
      `${API_BASE_URL}/orders/${MERCHANT_ID}?userId=${USER_ID}&limit=10`
    );
    
    if (ordersResponse.data.orders && ordersResponse.data.orders.length > 0) {
      console.log('✅ Pedidos encontrados:', ordersResponse.data.orders.length);
      console.log('');
      
      // Filtrar apenas pedidos que vieram do iFood (têm certas propriedades)
      const realIfoodOrders = ordersResponse.data.orders.filter(order => {
        // Pedidos reais do iFood têm estrutura específica
        return order.merchant && order.customer && order.items;
      });
      
      if (realIfoodOrders.length > 0) {
        console.log('🎯 PEDIDOS REAIS DO IFOOD ENCONTRADOS:');
        console.log('=====================================');
        
        realIfoodOrders.forEach((order, index) => {
          console.log(`\n${index + 1}. Pedido ${order.shortReference?.id || order.displayId || 'N/A'}`);
          console.log('   ID iFood:', order.id);
          console.log('   Status:', order.status?.value || order.status);
          console.log('   Cliente:', order.customer?.name || 'N/A');
          console.log('   Telefone:', order.customer?.phone || 'N/A');
          console.log('   Total:', order.total?.value ? `R$ ${(order.total.value/100).toFixed(2)}` : 'N/A');
          console.log('   Criado em:', order.createdAt);
          console.log('   Merchant:', order.merchant?.name || 'N/A');
        });
        
        // Selecionar o primeiro pedido que pode ter o status atualizado
        const testableOrder = realIfoodOrders.find(o => 
          o.status?.value === 'CONFIRMED' || 
          o.status?.value === 'PREPARING' ||
          o.status === 'CONFIRMED' ||
          o.status === 'PREPARING'
        );
        
        if (testableOrder) {
          console.log('\n');
          console.log('🎯 PEDIDO SELECIONADO PARA TESTE:');
          console.log('==================================');
          console.log('ID:', testableOrder.id);
          console.log('Status atual:', testableOrder.status?.value || testableOrder.status);
          console.log('');
          console.log('📝 Use este ID para testar a atualização de status:');
          console.log(`   node testUpdateRealOrder.js ${testableOrder.id}`);
          
          // Salvar o ID para uso posterior
          const fs = require('fs');
          fs.writeFileSync('real_order_id.txt', testableOrder.id);
          console.log('');
          console.log('✅ ID salvo em real_order_id.txt');
        } else {
          console.log('\n⚠️ Nenhum pedido em status que permite atualização');
          console.log('   (Procurando por CONFIRMED ou PREPARING)');
        }
        
      } else {
        console.log('⚠️ Nenhum pedido real do iFood encontrado');
        console.log('   Os pedidos no banco parecem ser de teste');
      }
    } else {
      console.log('📭 Nenhum pedido encontrado');
    }
    
    // 3. Parar o polling
    console.log('');
    console.log('3️⃣ Parando o polling...');
    await axios.post(
      `${API_BASE_URL}/orders/polling/stop`,
      { userId: USER_ID }
    );
    console.log('✅ Polling parado');
    
    console.log('');
    console.log('📋 RESUMO:');
    console.log('==========');
    console.log('Se nenhum pedido real foi encontrado, você precisa:');
    console.log('1. Fazer um pedido de teste no painel do iFood');
    console.log('2. Esperar o pedido aparecer no painel do merchant');
    console.log('3. Executar este script novamente para capturar o pedido');
    console.log('4. Usar o ID do pedido real para testar as atualizações de status');
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

// Executar
testRealIfoodOrders().catch(console.error);