const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const USER_ID = 'c1488646-aca8-4220-aacc-00e7ae3d6490';
const ORDER_ID = '8789d16a-4d40-4f2f-8049-218c6f507362';

async function checkDatabase() {
  console.log('🔍 Verificando diretamente no banco de dados...');
  console.log('');
  
  try {
    // 1. Verificar merchants do usuário
    console.log('1️⃣ Buscando merchants do usuário...');
    const { data: merchants, error: merchantError } = await supabase
      .from('ifood_merchants')
      .select('*')
      .eq('user_id', USER_ID);
    
    if (merchantError) {
      console.error('❌ Erro ao buscar merchants:', merchantError);
    } else if (merchants && merchants.length > 0) {
      console.log('✅ Merchants encontrados:', merchants.length);
      merchants.forEach(m => {
        console.log(`   - ${m.name} (ID: ${m.merchant_id})`);
      });
      console.log('');
    } else {
      console.log('📭 Nenhum merchant encontrado para este usuário');
      console.log('');
    }
    
    // 2. Verificar o pedido específico
    console.log('2️⃣ Buscando pedido específico...');
    const { data: orders, error: orderError } = await supabase
      .from('ifood_orders')
      .select('*')
      .eq('ifood_order_id', ORDER_ID);
    
    if (orderError) {
      console.error('❌ Erro ao buscar pedido:', orderError);
    } else if (orders && orders.length > 0) {
      const order = orders[0];
      console.log('✅ Pedido encontrado:');
      console.log('   ID:', order.ifood_order_id);
      console.log('   Display ID:', order.display_id);
      console.log('   Status:', order.status);
      console.log('   Merchant ID:', order.merchant_id);
      console.log('   User ID:', order.user_id);
      console.log('   Cliente:', order.customer_name);
      console.log('   Criado em:', order.created_at);
      console.log('');
      
      // Verificar se o user_id corresponde
      if (order.user_id === USER_ID) {
        console.log('✅ O pedido pertence ao usuário correto');
      } else {
        console.log('⚠️ ATENÇÃO: O pedido está associado a outro usuário!');
        console.log('   User ID do pedido:', order.user_id);
        console.log('   User ID tentando atualizar:', USER_ID);
      }
      
      // Verificar o merchant
      console.log('');
      console.log('3️⃣ Verificando merchant do pedido...');
      const { data: orderMerchant, error: orderMerchantError } = await supabase
        .from('ifood_merchants')
        .select('*')
        .eq('merchant_id', order.merchant_id)
        .single();
      
      if (orderMerchantError) {
        console.error('❌ Erro ao buscar merchant do pedido:', orderMerchantError);
      } else if (orderMerchant) {
        console.log('🏪 Merchant do pedido:');
        console.log('   Nome:', orderMerchant.name);
        console.log('   ID:', orderMerchant.merchant_id);
        console.log('   User ID do merchant:', orderMerchant.user_id);
        
        if (orderMerchant.user_id === USER_ID) {
          console.log('   ✅ Merchant pertence ao usuário');
        } else {
          console.log('   ❌ Merchant pertence a outro usuário:', orderMerchant.user_id);
        }
      }
      
      console.log('');
      console.log('📋 RESUMO:');
      console.log('==========');
      console.log('Order ID:', ORDER_ID);
      console.log('Merchant ID do pedido:', order.merchant_id);
      console.log('User ID do pedido:', order.user_id);
      console.log('User ID tentando atualizar:', USER_ID);
      console.log('Status atual:', order.status);
      
      if (order.user_id !== USER_ID) {
        console.log('');
        console.log('❌ PROBLEMA IDENTIFICADO:');
        console.log('O pedido está associado a um user_id diferente!');
        console.log('Isso explica o erro "Access denied: User does not own this merchant"');
        console.log('');
        console.log('🔧 SOLUÇÃO:');
        console.log('Use o user_id correto do pedido:', order.user_id);
      }
      
    } else {
      console.log('📭 Pedido não encontrado no banco de dados');
    }
    
    // 4. Buscar todos os pedidos do usuário
    console.log('');
    console.log('4️⃣ Buscando todos os pedidos do usuário...');
    const { data: userOrders, error: userOrdersError } = await supabase
      .from('ifood_orders')
      .select('ifood_order_id, display_id, status, merchant_id, created_at')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (userOrdersError) {
      console.error('❌ Erro ao buscar pedidos do usuário:', userOrdersError);
    } else if (userOrders && userOrders.length > 0) {
      console.log(`✅ Últimos ${userOrders.length} pedidos do usuário:`);
      userOrders.forEach((o, i) => {
        console.log(`   ${i+1}. ${o.display_id} (${o.ifood_order_id.substring(0, 8)}...) - Status: ${o.status}`);
      });
    } else {
      console.log('📭 Nenhum pedido encontrado para este usuário');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar
checkDatabase().catch(console.error);