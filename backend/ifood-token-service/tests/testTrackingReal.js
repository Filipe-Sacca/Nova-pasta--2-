const axios = require('axios');

const API_BASE_URL = 'http://localhost:8085';
const USER_ID = 'c1488646-aca8-4220-aacc-00e7ae3d6490';
const MERCHANT_ID = '577cb3b1-5845-4fbc-a219-8cd3939cb9ea';

async function testRealTracking() {
  console.log('🚴 Teste de Rastreamento Real do iFood');
  console.log('=====================================\n');
  
  try {
    // 1. Primeiro, buscar pedidos ativos
    console.log('1️⃣ Buscando pedidos ativos...');
    const ordersResponse = await axios.get(
      `${API_BASE_URL}/orders/${MERCHANT_ID}?userId=${USER_ID}`
    );
    
    if (!ordersResponse.data.orders || ordersResponse.data.orders.length === 0) {
      console.log('❌ Nenhum pedido ativo encontrado');
      console.log('\n📝 Para testar o rastreamento:');
      console.log('1. Faça um pedido real no iFood');
      console.log('2. Aceite o pedido no painel');
      console.log('3. Marque como "Despachado"');
      console.log('4. Execute este script novamente');
      return;
    }
    
    // Procurar um pedido que está despachado
    const dispatchedOrder = ordersResponse.data.orders.find(o => 
      o.status === 'DISPATCHED' || 
      o.status?.value === 'DISPATCHED' ||
      o.status === 'IN_TRANSIT' ||
      o.status?.value === 'IN_TRANSIT'
    );
    
    if (!dispatchedOrder) {
      console.log('⚠️ Nenhum pedido em entrega encontrado');
      console.log('Pedidos disponíveis:');
      ordersResponse.data.orders.forEach(o => {
        console.log(`  - ${o.id}: Status ${o.status?.value || o.status}`);
      });
      console.log('\n💡 Despache um pedido primeiro para poder rastrear');
      return;
    }
    
    const ORDER_ID = dispatchedOrder.id;
    console.log('✅ Pedido em entrega encontrado:', ORDER_ID);
    console.log('   Cliente:', dispatchedOrder.customer?.name || 'N/A');
    console.log('   Status:', dispatchedOrder.status?.value || dispatchedOrder.status);
    console.log('');
    
    // 2. Buscar URL de rastreamento
    console.log('2️⃣ Buscando URL de rastreamento...');
    try {
      const trackingResponse = await axios.get(
        `${API_BASE_URL}/shipping/tracking?orderId=${ORDER_ID}`
      );
      
      if (trackingResponse.data.success && trackingResponse.data.data?.trackingUrl) {
        console.log('✅ URL de rastreamento obtida!');
        console.log('');
        console.log('🔗 LINK DE RASTREAMENTO:');
        console.log('========================');
        console.log(trackingResponse.data.data.trackingUrl);
        console.log('');
        console.log('📱 Como testar:');
        console.log('1. Abra este link no seu celular');
        console.log('2. Você verá a posição do entregador em tempo real');
        console.log('3. O cliente também pode usar este link');
        console.log('');
        console.log('💡 Este é o mesmo link que o cliente recebe no app do iFood!');
      } else {
        console.log('⚠️ URL de rastreamento não disponível ainda');
        console.log('Possíveis motivos:');
        console.log('- Entregador ainda não foi atribuído');
        console.log('- Pedido é para retirada (não tem entrega)');
        console.log('- iFood ainda está processando');
      }
    } catch (trackingError) {
      console.log('❌ Erro ao buscar tracking:', trackingError.response?.data || trackingError.message);
    }
    
    // 3. Buscar status de entrega detalhado
    console.log('\n3️⃣ Buscando status detalhado da entrega...');
    try {
      const shippingResponse = await axios.get(
        `${API_BASE_URL}/shipping/status?orderId=${ORDER_ID}`
      );
      
      if (shippingResponse.data.success && shippingResponse.data.data) {
        const shipping = shippingResponse.data.data;
        console.log('📦 Status da Entrega:');
        console.log('   Status:', shipping.status || 'N/A');
        console.log('   Sub-status:', shipping.subStatus || 'N/A');
        console.log('   Tempo estimado:', shipping.estimatedDeliveryTime || 'N/A');
        
        if (shipping.deliveryPerson) {
          console.log('\n👤 Entregador:');
          console.log('   Nome:', shipping.deliveryPerson.name);
          console.log('   Telefone:', shipping.deliveryPerson.phone);
          console.log('   Veículo:', shipping.deliveryPerson.vehicleType || 'N/A');
        } else {
          console.log('\n⏳ Aguardando atribuição de entregador...');
        }
      }
    } catch (shippingError) {
      console.log('ℹ️ Status de entrega não disponível');
    }
    
    // 4. Instruções para simular entregador
    console.log('\n');
    console.log('🎯 COMO SIMULAR QUE VOCÊ É O ENTREGADOR:');
    console.log('=========================================');
    console.log('1. Abra o app do iFood (cliente)');
    console.log('2. Vá em "Pedidos"');
    console.log('3. Clique no pedido ativo');
    console.log('4. Você verá o mapa com o entregador');
    console.log('');
    console.log('OU');
    console.log('');
    console.log('1. Use o link de rastreamento acima');
    console.log('2. Abra no celular');
    console.log('3. Acompanhe em tempo real');
    console.log('');
    console.log('📝 NOTA: O rastreamento real só funciona quando:');
    console.log('- O pedido foi despachado');
    console.log('- O iFood atribuiu um entregador');
    console.log('- O entregador aceitou e está a caminho');
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

// Executar
testRealTracking().catch(console.error);