const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function debugUpdate() {
  console.log('🔍 Debugging update operation...');

  const itemId = '9a805e5d-fdb4-4554-9ec0-dcce06bc9d97';
  const merchantId = '577cb3b1-5845-4fbc-a219-8cd3939cb9ea';

  // 1. Verificar se o produto existe com esses filtros
  console.log('🔍 [STEP 1] Verificando se produto existe com os filtros usados...');
  const { data: existingProduct, error: selectError } = await supabase
    .from('products')
    .select('*')
    .eq('item_id', itemId)
    .eq('merchant_id', merchantId);

  console.log('📊 Resultados da busca:', existingProduct?.length || 0, 'produtos encontrados');
  if (selectError) {
    console.error('❌ Erro na busca:', selectError);
  }

  if (existingProduct && existingProduct.length > 0) {
    console.log('✅ Produto encontrado:', existingProduct[0]);

    // 2. Tentar atualizar com logging detalhado
    console.log('🔍 [STEP 2] Tentando atualizar produto...');
    const { data: updateData, error: updateError } = await supabase
      .from('products')
      .update({
        is_active: false, // UNAVAILABLE
        updated_at: new Date().toISOString()
      })
      .eq('item_id', itemId)
      .eq('merchant_id', merchantId)
      .select(); // Adicionar select para ver o que foi atualizado

    if (updateError) {
      console.error('❌ Erro na atualização:', updateError);
    } else {
      console.log('✅ Dados retornados da atualização:', updateData);
      console.log('📊 Número de registros atualizados:', updateData?.length || 0);
    }

    // 3. Verificar o status após atualização
    console.log('🔍 [STEP 3] Verificando status após atualização...');
    const { data: afterUpdate } = await supabase
      .from('products')
      .select('item_id, name, is_active, updated_at')
      .eq('item_id', itemId)
      .eq('merchant_id', merchantId)
      .single();

    if (afterUpdate) {
      console.log('📊 Status após update:', {
        name: afterUpdate.name,
        is_active: afterUpdate.is_active,
        updated_at: afterUpdate.updated_at
      });
    }
  } else {
    console.log('❌ Produto não encontrado com os filtros especificados');

    // Verificar se existe com apenas item_id
    const { data: byItemOnly } = await supabase
      .from('products')
      .select('*')
      .eq('item_id', itemId);

    console.log('🔍 Produtos encontrados apenas por item_id:', byItemOnly?.length || 0);
    if (byItemOnly && byItemOnly.length > 0) {
      console.log('📊 Merchant IDs encontrados:', byItemOnly.map(p => p.merchant_id));
    }
  }
}

debugUpdate().catch(console.error);