const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_BASE_URL = 'http://localhost:8085';
const USER_ID = 'c1488646-aca8-4220-aacc-00e7ae3d6490';
const MERCHANT_ID = '577cb3b1-5845-4fbc-a219-8cd3939cb9ea';

async function createTestOrderFromIfood() {
  console.log('📦 Criando pedido de teste que simula um pedido real do iFood...');
  console.log('');
  
  try {
    // Gerar um ID único que parece com um ID do iFood
    const orderId = uuidv4();
    const shortReference = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Estrutura de um pedido real do iFood
    const testOrder = {
      userId: USER_ID,
      merchantId: MERCHANT_ID,
      orders: [{
        id: orderId,
        code: shortReference,
        shortReference: {
          id: shortReference
        },
        createdAt: new Date().toISOString(),
        merchant: {
          id: MERCHANT_ID,
          name: 'Teste - PLANO CERTO DELIVERY LTDA'
        },
        customer: {
          id: uuidv4(),
          name: 'Cliente Teste iFood',
          phone: '11999999999',
          email: 'teste@cliente.com',
          documentNumber: '12345678900'
        },
        items: [
          {
            id: uuidv4(),
            name: 'Hambúrguer Teste',
            quantity: 1,
            price: 2500, // R$ 25,00 em centavos
            subItems: [],
            observations: 'Sem cebola'
          },
          {
            id: uuidv4(),
            name: 'Batata Frita',
            quantity: 1,
            price: 1200, // R$ 12,00 em centavos
            subItems: []
          },
          {
            id: uuidv4(),
            name: 'Refrigerante',
            quantity: 1,
            price: 800, // R$ 8,00 em centavos
            subItems: []
          }
        ],
        subTotal: {
          value: 4500,
          currency: 'BRL'
        },
        totalPrice: {
          value: 4500,
          currency: 'BRL'
        },
        total: {
          value: 4500,
          currency: 'BRL'
        },
        deliveryFee: {
          value: 0,
          currency: 'BRL'
        },
        deliveryAddress: {
          streetAddress: 'Rua Teste, 123',
          neighborhood: 'Bairro Teste',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01234-567',
          coordinates: {
            latitude: -23.5505,
            longitude: -46.6333
          }
        },
        delivery: {
          mode: 'DEFAULT',
          deliveryDateTime: new Date(Date.now() + 45 * 60000).toISOString() // 45 minutos
        },
        orderType: 'DELIVERY',
        payments: {
          methods: [
            {
              type: 'CREDIT',
              value: 4500,
              currency: 'BRL'
            }
          ],
          pending: 0,
          prepaid: 4500
        },
        status: {
          value: 'PLACED',
          date: new Date().toISOString()
        },
        isTest: false, // Marcamos como não-teste para simular um pedido real
        salesChannel: 'IFOOD'
      }]
    };
    
    console.log('📝 Detalhes do pedido de teste:');
    console.log('   ID:', orderId);
    console.log('   Código curto:', shortReference);
    console.log('   Cliente:', testOrder.orders[0].customer.name);
    console.log('   Total: R$', (testOrder.orders[0].total.value / 100).toFixed(2));
    console.log('');
    
    // Importar o pedido via Virtual Bag
    console.log('📤 Importando pedido via Virtual Bag API...');
    const response = await axios.post(
      `${API_BASE_URL}/orders/virtual-bag`,
      testOrder
    );
    
    if (response.data.success) {
      console.log('✅ Pedido importado com sucesso!');
      console.log('');
      console.log('📊 Resultado:');
      console.log('   Pedidos processados:', response.data.data?.processed || 0);
      console.log('   Pedidos salvos:', response.data.data?.saved || 0);
      console.log('   Erros:', response.data.data?.errors || 0);
      
      if (response.data.data?.orders && response.data.data.orders.length > 0) {
        const importedOrder = response.data.data.orders[0];
        console.log('');
        console.log('🎯 PEDIDO CRIADO COM SUCESSO:');
        console.log('==============================');
        console.log('ID do Pedido:', importedOrder.ifood_order_id || orderId);
        console.log('Display ID:', importedOrder.display_id || shortReference);
        console.log('Status:', importedOrder.status || 'PLACED');
        console.log('');
        console.log('📝 IMPORTANTE:');
        console.log('Este pedido foi criado localmente mas tem a estrutura de um pedido real do iFood.');
        console.log('Ele pode ser usado para testar atualizações de status localmente,');
        console.log('mas a sincronização com o iFood ainda falhará porque o pedido não existe lá.');
        console.log('');
        console.log('Para testar a sincronização completa com o iFood, você precisa:');
        console.log('1. Fazer um pedido real no iFood');
        console.log('2. Ou usar o ambiente de sandbox do iFood (se disponível)');
        
        // Salvar o ID para testes
        const fs = require('fs');
        fs.writeFileSync('test_order_id.txt', importedOrder.ifood_order_id || orderId);
        console.log('');
        console.log('✅ ID do pedido salvo em test_order_id.txt');
        console.log('');
        console.log('🔧 Para testar a atualização de status local:');
        console.log(`   node testUpdateStatus.js ${importedOrder.ifood_order_id || orderId}`);
      }
    } else {
      console.log('❌ Erro ao importar pedido:', response.data.error);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

// Executar
createTestOrderFromIfood().catch(console.error);