const axios = require('axios');

const API_BASE_URL = 'http://localhost:8085';
const ORDER_ID = '8789d16a-4d40-4f2f-8049-218c6f507362';
const USER_ID = 'c1488646-aca8-4220-aacc-00e7ae3d6490';

async function testStatusUpdate() {
  console.log('🚀 Testando atualização de status do pedido...');
  console.log('📦 Order ID:', ORDER_ID);
  console.log('👤 User ID:', USER_ID);
  console.log('');
  
  try {
    // Primeiro, vamos verificar se o endpoint está funcionando
    console.log('1️⃣ Verificando saúde do serviço...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Serviço está funcionando:', healthResponse.data);
    console.log('');
    
    // Testar atualização para DISPATCHED (já que READY_FOR_PICKUP já está)
    console.log('2️⃣ Tentando atualizar status para DISPATCHED...');
    console.log('   (Mudando de READY_FOR_PICKUP para DISPATCHED)');
    console.log('');
    
    const updateResponse = await axios.put(
      `${API_BASE_URL}/orders/${ORDER_ID}/status`,
      {
        userId: USER_ID,
        status: 'DISPATCHED'
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
    
    // Analisar a resposta
    if (updateResponse.data.success) {
      console.log('✅ Status atualizado no banco local com sucesso!');
      
      if (updateResponse.data.data?.ifoodApiUpdated === false) {
        console.log('');
        console.log('⚠️ PROBLEMA NA SINCRONIZAÇÃO COM O IFOOD:');
        console.log('============================================');
        console.log('O status foi atualizado no banco de dados local,');
        console.log('mas NÃO foi sincronizado com o iFood!');
        console.log('');
        console.log('🔍 POSSÍVEIS CAUSAS:');
        console.log('1. Token de acesso expirado ou inválido');
        console.log('2. Problema de conectividade com a API do iFood');
        console.log('3. O pedido não existe no iFood (foi criado apenas localmente para teste)');
        console.log('4. O status do pedido no iFood não permite essa transição');
        console.log('');
        console.log('🔧 AÇÕES RECOMENDADAS:');
        console.log('1. Verificar se o token está válido e renovar se necessário');
        console.log('2. Verificar os logs do servidor para detalhes do erro');
        console.log('3. Verificar se o pedido existe no painel do iFood');
        console.log('4. Tentar com um pedido real do iFood');
      } else if (updateResponse.data.data?.ifoodApiUpdated === true) {
        console.log('');
        console.log('🎉 SUCESSO COMPLETO!');
        console.log('====================');
        console.log('✅ Status atualizado no banco local');
        console.log('✅ Status sincronizado com o iFood');
        console.log('');
        console.log('O pedido agora está marcado como DISPATCHED no iFood!');
      } else {
        console.log('');
        console.log('ℹ️ Status da sincronização com iFood não informado');
        console.log('Verifique os logs do servidor para mais detalhes');
      }
      
      // Mostrar status anterior se disponível
      if (updateResponse.data.data?.previousStatus) {
        console.log('');
        console.log('📊 Transição de status:');
        console.log(`   ${updateResponse.data.data.previousStatus} → ${updateResponse.data.data.newStatus}`);
      }
    } else {
      console.log('❌ Falha ao atualizar o status');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      console.log('');
      console.log('⚠️ Erro de validação. Possíveis causas:');
      console.log('- Status inválido');
      console.log('- Pedido não encontrado');
      console.log('- Usuário não tem permissão');
    } else if (error.response?.status === 500) {
      console.log('');
      console.log('⚠️ Erro interno do servidor');
      console.log('Verifique os logs do servidor para mais detalhes');
    }
  }
  
  console.log('');
  console.log('📝 NOTA IMPORTANTE:');
  console.log('===================');
  console.log('Se o pedido foi criado apenas para teste (não veio do iFood),');
  console.log('é normal que a sincronização com o iFood falhe.');
  console.log('Para testar a sincronização completa, use um pedido real do iFood.');
}

// Executar o teste
testStatusUpdate().catch(console.error);