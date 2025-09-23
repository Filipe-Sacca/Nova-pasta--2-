const axios = require('axios');

const API_BASE_URL = 'http://localhost:8085';
const USER_ID = 'c1488646-aca8-4220-aacc-00e7ae3d6490';

async function getMerchantAndOrders() {
  console.log('🔍 Buscando merchant e pedidos para o usuário...');
  console.log('👤 User ID:', USER_ID);
  console.log('');
  
  try {
    // 1. Primeiro buscar todos os merchants do usuário
    console.log('1️⃣ Buscando merchants do usuário...');
    const merchantsResponse = await axios.post(
      `${API_BASE_URL}/merchants/refresh`,
      { user_id: USER_ID }
    );
    
    console.log('📦 Merchants encontrados:', merchantsResponse.data.merchants?.length || 0);
    if (merchantsResponse.data.merchants && merchantsResponse.data.merchants.length > 0) {
      const merchant = merchantsResponse.data.merchants[0];
      console.log('🏪 Merchant principal:');
      console.log('   ID:', merchant.id);
      console.log('   Nome:', merchant.name);
      console.log('   Status:', merchant.status);
      console.log('');
      
      const MERCHANT_ID = merchant.id;
      
      // 2. Buscar pedidos deste merchant
      console.log('2️⃣ Buscando pedidos do merchant...');
      const ordersResponse = await axios.get(
        `${API_BASE_URL}/orders/${MERCHANT_ID}?userId=${USER_ID}&limit=10`
      );
      
      if (ordersResponse.data.orders && ordersResponse.data.orders.length > 0) {
        console.log('📋 Pedidos encontrados:', ordersResponse.data.orders.length);
        console.log('');
        console.log('Lista de pedidos:');
        console.log('================');
        
        ordersResponse.data.orders.forEach((order, index) => {
          console.log(`\n${index + 1}. Pedido ${order.display_id || order.shortReference?.id || 'N/A'}`);
          console.log('   ID iFood:', order.id);
          console.log('   Status:', order.status?.value || order.status);
          console.log('   Cliente:', order.customer?.name || 'N/A');
          console.log('   Total:', order.total?.value ? `R$ ${(order.total.value/100).toFixed(2)}` : 'N/A');
          console.log('   Criado em:', order.createdAt);
        });
        
        // Procurar especificamente o pedido que tentamos atualizar
        const targetOrder = ordersResponse.data.orders.find(o => 
          o.id === '8789d16a-4d40-4f2f-8049-218c6f507362'
        );
        
        if (targetOrder) {
          console.log('\n');
          console.log('🎯 PEDIDO ALVO ENCONTRADO:');
          console.log('==========================');
          console.log('ID:', targetOrder.id);
          console.log('Display ID:', targetOrder.display_id || targetOrder.shortReference?.id);
          console.log('Status atual:', targetOrder.status?.value || targetOrder.status);
          console.log('');
          console.log('✅ Use este ID para testar: ', targetOrder.id);
          console.log('✅ Merchant ID:', MERCHANT_ID);
        } else {
          console.log('\n⚠️ Pedido 8789d16a-4d40-4f2f-8049-218c6f507362 não encontrado na lista atual');
        }
        
      } else {
        console.log('📭 Nenhum pedido encontrado para este merchant');
      }
      
      // 3. Buscar pedidos completados também
      console.log('\n3️⃣ Buscando pedidos completados...');
      try {
        const completedResponse = await axios.get(
          `${API_BASE_URL}/orders/${MERCHANT_ID}/completed?userId=${USER_ID}&limit=10`
        );
        
        if (completedResponse.data.orders && completedResponse.data.orders.length > 0) {
          console.log('✅ Pedidos completados:', completedResponse.data.orders.length);
          
          const targetCompleted = completedResponse.data.orders.find(o => 
            o.ifood_order_id === '8789d16a-4d40-4f2f-8049-218c6f507362'
          );
          
          if (targetCompleted) {
            console.log('\n🎯 PEDIDO ENCONTRADO NOS COMPLETADOS:');
            console.log('=====================================');
            console.log('ID iFood:', targetCompleted.ifood_order_id);
            console.log('Display ID:', targetCompleted.display_id);
            console.log('Status:', targetCompleted.status);
            console.log('Cliente:', targetCompleted.customer_name);
            console.log('');
            console.log('📝 Este pedido está nos pedidos completados');
            console.log('✅ Merchant ID correto:', MERCHANT_ID);
          }
        }
      } catch (err) {
        console.log('⚠️ Erro ao buscar pedidos completados:', err.response?.data || err.message);
      }
      
    } else {
      console.log('❌ Nenhum merchant encontrado para este usuário');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

// Executar
getMerchantAndOrders().catch(console.error);