const { IFoodProductService } = require('./dist/ifoodProductService');
require('dotenv').config();

const productService = new IFoodProductService(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testPauseWithLogging() {
  console.log('🔄 Testando pausar produto...');

  const result = await productService.updateItemStatus(
    'c1488646-aca8-4220-aacc-00e7ae3d6490', // user_id
    '577cb3b1-5845-4fbc-a219-8cd3939cb9ea', // merchant_id
    {
      itemId: '9a805e5d-fdb4-4554-9ec0-dcce06bc9d97',
      status: 'UNAVAILABLE'
    }
  );

  console.log('📊 Resultado final:', result.success ? '✅ Sucesso' : '❌ Erro');
  if (!result.success) console.log('❌ Erro:', result.error);

  // Verificar no banco após 2 segundos
  setTimeout(async () => {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const { data, error } = await supabase
      .from('products')
      .select('name, is_active, updated_at')
      .eq('item_id', '9a805e5d-fdb4-4554-9ec0-dcce06bc9d97')
      .single();

    if (data) {
      console.log('🗄️ STATUS NO BANCO APÓS TESTE:');
      console.log('📦 Nome:', data.name);
      console.log('🔄 Status:', data.is_active ? 'AVAILABLE (Ativo)' : 'UNAVAILABLE (Pausado)');
      console.log('⏰ Atualizado em:', data.updated_at);
    }
  }, 2000);
}

testPauseWithLogging().catch(console.error);