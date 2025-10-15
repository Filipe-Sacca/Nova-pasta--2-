import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface IFoodProduct {
  id: string;
  name: string;
  description?: string;
  price?: { value?: number; originalValue?: number };
  status?: string;
  shifts?: any[];
  optionGroups?: IFoodOptionGroup[];
}

interface IFoodOptionGroup {
  id: string;
  name: string;
  min?: number;
  max?: number;
  options?: IFoodOption[];
}

interface IFoodOption {
  id: string;
  name?: string;
  description?: string;
  price?: { value?: number };
  status?: string;
}

interface IFoodCategory {
  id: string;
  name: string;
}

/**
 * Sincroniza categorias de um merchant
 */
export async function syncCategories(merchantId: string, accessToken: string): Promise<void> {
  console.log(`📂 [SYNC] Starting categories sync for merchant ${merchantId}`);

  try {
    // 1. Buscar catalog_id e user_id (cache ou API)
    const { data: merchant } = await supabase
      .from('ifood_merchants')
      .select('catalog_id, user_id')
      .eq('merchant_id', merchantId)
      .single();

    let catalogId = merchant?.catalog_id;
    const userId = merchant?.user_id;

    // Se não existe cache, buscar da API
    if (!catalogId) {
      const catalogsResponse = await axios.get(
        `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      catalogId = catalogsResponse.data[0]?.catalogId;

      // Salvar no cache
      await supabase
        .from('ifood_merchants')
        .update({
          catalog_id: catalogId,
          catalog_synced_at: new Date().toISOString()
        })
        .eq('merchant_id', merchantId);

      console.log(`💾 [SYNC] Catalog ID cached: ${catalogId}`);
    }

    // 2. Buscar categorias do iFood
    const categoriesResponse = await axios.get(
      `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const ifoodCategories: IFoodCategory[] = categoriesResponse.data;
    console.log(`📦 [SYNC] Found ${ifoodCategories.length} categories from iFood`);

    // 3. Buscar categorias existentes no banco
    const { data: existingCategories } = await supabase
      .from('ifood_categories')
      .select('category_id')
      .eq('merchant_id', merchantId);

    const existingIds = new Set(existingCategories?.map(c => c.category_id) || []);
    const ifoodIds = new Set(ifoodCategories.map(c => c.id));

    // 4. Detectar categorias removidas
    const removedIds = [...existingIds].filter(id => !ifoodIds.has(id));

    if (removedIds.length > 0) {
      await supabase
        .from('ifood_categories')
        .delete()
        .in('category_id', removedIds)
        .eq('merchant_id', merchantId);

      console.log(`🗑️ [SYNC] Removed ${removedIds.length} categories`);
    }

    // 5. Upsert categorias
    const categoriesToUpsert = ifoodCategories.map(cat => ({
      merchant_id: merchantId,
      category_id: cat.id,
      ifood_category_id: cat.id,
      catalog_id: catalogId,
      user_id: userId,
      name: cat.name
    }));

    if (categoriesToUpsert.length > 0) {
      console.log(`💾 [SYNC] Saving ${categoriesToUpsert.length} categories:`, categoriesToUpsert.map(c => c.name).join(', '));
      const { data: savedCategories, error: categoriesError } = await supabase
        .from('ifood_categories')
        .upsert(categoriesToUpsert, { onConflict: 'category_id' });

      if (categoriesError) {
        console.error(`❌ [SYNC] Error saving categories:`, categoriesError);
        throw categoriesError;
      }
      console.log(`✅ [SYNC] Upserted ${categoriesToUpsert.length} categories successfully`);
    }

    // 6. Atualizar timestamp de sync
    await supabase
      .from('ifood_merchants')
      .update({
        categories_synced_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        sync_status: 'success'
      })
      .eq('merchant_id', merchantId);

    console.log(`✅ [SYNC] Categories sync completed for merchant ${merchantId}`);

  } catch (error: any) {
    console.error(`❌ [SYNC] Categories sync failed for merchant ${merchantId}:`, error.message);

    // Atualizar status de erro
    await supabase
      .from('ifood_merchants')
      .update({
        sync_status: 'error',
        last_sync_at: new Date().toISOString()
      })
      .eq('merchant_id', merchantId);

    throw error;
  }
}

/**
 * Sincroniza produtos, grupos de complementos e complementos de uma categoria
 */
export async function syncProducts(merchantId: string, categoryId: string, accessToken: string): Promise<void> {
  console.log(`🍽️ [SYNC] Starting products sync for merchant ${merchantId}, category ${categoryId}`);

  try {
    // 1. Buscar catalog_id e user_id (cache)
    const { data: merchant } = await supabase
      .from('ifood_merchants')
      .select('catalog_id, user_id')
      .eq('merchant_id', merchantId)
      .single();

    const catalogId = merchant?.catalog_id;
    const userId = merchant?.user_id;

    if (!catalogId) {
      throw new Error(`No catalog_id found for merchant ${merchantId}`);
    }

    console.log(`📚 [SYNC] Using catalog_id: ${catalogId}`);

    // 2. Buscar produtos da categoria via API iFood
    const productsUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/categories/${categoryId}/items`;
    console.log(`🌐 [SYNC] Fetching products from: ${productsUrl}`);

    const productsResponse = await axios.get(productsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const responseData = productsResponse.data;
    const items = responseData.items || [];
    const products = responseData.products || [];
    const optionGroups = responseData.optionGroups || [];
    const options = responseData.options || [];

    console.log(`📦 [SYNC] Found ${items.length} items, ${products.length} products, ${optionGroups.length} option groups, ${options.length} options`);

    // Criar Maps para lookup rápido
    const productsMap = new Map(products.map((p: any) => [p.id, p]));
    const optionGroupsMap = new Map(optionGroups.map((og: any) => [og.id, og]));
    const optionsMap = new Map(options.map((opt: any) => [opt.id, opt]));

    // 3. Buscar produtos existentes no banco para esta categoria
    const { data: existingProducts } = await supabase
      .from('products')
      .select('item_id')
      .eq('merchant_id', merchantId)
      .eq('ifood_category_id', categoryId);

    const existingIds = new Set(existingProducts?.map(p => p.item_id) || []);
    const ifoodIds = new Set(items.map((item: any) => item.id));

    // 4. Detectar produtos removidos
    const removedIds = [...existingIds].filter(id => !ifoodIds.has(id));

    if (removedIds.length > 0) {
      await supabase
        .from('products')
        .delete()
        .in('item_id', removedIds)
        .eq('merchant_id', merchantId);

      console.log(`🗑️ [SYNC] Removed ${removedIds.length} products`);
    }

    // 5. Processar cada item
    for (const item of items) {
      // Buscar produto correspondente
      const product = productsMap.get(item.productId);

      if (!product) {
        console.warn(`⚠️ [SYNC] Product ${item.productId} not found for item ${item.id}`);
        continue;
      }

      await syncSingleProduct(
        merchantId,
        categoryId,
        item,
        product,
        userId,
        optionGroupsMap,
        optionsMap,
        productsMap
      );
    }

    console.log(`✅ [SYNC] Products sync completed for category ${categoryId}`);

  } catch (error: any) {
    console.error(`❌ [SYNC] Products sync failed for category ${categoryId}:`, error.message);
    throw error;
  }
}

/**
 * Sincroniza um único produto com seus grupos de complementos e complementos
 */
async function syncSingleProduct(
  merchantId: string,
  categoryId: string,
  item: any,
  product: any,
  userId: string,
  optionGroupsMap: Map<string, any>,
  optionsMap: Map<string, any>,
  productsMap: Map<string, any>
): Promise<void> {

  // ============================================================================
  // 🆕 COLETAR option_ids ANTES de salvar o produto
  // ============================================================================
  const allOptionIds: string[] = [];

  if (product.optionGroups && product.optionGroups.length > 0) {
    for (const productOptionGroup of product.optionGroups) {
      const optionGroup = optionGroupsMap.get(productOptionGroup.id);

      if (optionGroup && optionGroup.optionIds && optionGroup.optionIds.length > 0) {
        // Adicionar todos os option_ids deste grupo
        allOptionIds.push(...optionGroup.optionIds);
      }
    }
  }

  console.log(`🎯 [SYNC] Product ${product.name} has ${allOptionIds.length} option_ids:`, allOptionIds);

  // 1. Upsert produto (item + product data)
  const productData = {
    merchant_id: merchantId,
    user_id: userId,
    item_id: item.id,                          // ID do item
    product_id: item.productId,                // ID do produto
    ifood_category_id: categoryId,
    name: product.name || 'Sem nome',          // Nome do produto
    description: product.description || null,  // Descrição do produto
    imagePath: product.imagePath || null,      // Imagem do produto
    price: item.price?.value || 0,             // Preço do item
    original_price: item.price?.originalValue || item.price?.value || 0,
    is_active: item.status || 'AVAILABLE',     // Status do item
    option_ids: allOptionIds.length > 0 ? allOptionIds : null  // ✅ Array de option_ids (nome correto da coluna)
  };

  console.log(`💾 [SYNC] Saving product: ${product.name} (item: ${item.id}, product: ${item.productId})`);
  const { error: productError } = await supabase
    .from('products')
    .upsert(productData, { onConflict: 'merchant_id,item_id' });

  if (productError) {
    console.error(`❌ [SYNC] Error saving product ${product.name}:`, productError);
    throw productError;
  }
  console.log(`✅ [SYNC] Product saved successfully: ${product.name}`);

  // 2. Se não tem option groups, terminar aqui
  if (!product.optionGroups || product.optionGroups.length === 0) {
    return;
  }

  // 3. Processar option groups (complement_groups)
  for (const productOptionGroup of product.optionGroups) {
    // Buscar optionGroup completo
    const optionGroup = optionGroupsMap.get(productOptionGroup.id);

    if (!optionGroup) {
      console.warn(`⚠️ [SYNC] Option group ${productOptionGroup.id} not found`);
      continue;
    }

    // Upsert complement_group
    const groupData = {
      merchant_id: merchantId,
      group_compl_id: optionGroup.id,
      name: optionGroup.name,
      status: optionGroup.status || 'AVAILABLE',
      option_group_type: optionGroup.optionGroupType || 'SINGLE',
      min_selection: optionGroup.min || 0,
      max_selection: optionGroup.max || 1,
      product_ids: [item.productId],
      option_ids: optionGroup.optionIds || []
    };

    await supabase
      .from('complement_groups')
      .upsert(groupData, { onConflict: 'group_compl_id' });

    // 4. Processar options (complementos)
    if (optionGroup.optionIds && optionGroup.optionIds.length > 0) {
      console.log(`🍴 [SYNC] Processing ${optionGroup.optionIds.length} options for group ${optionGroup.name}`);

      for (const optionId of optionGroup.optionIds) {
        const option = optionsMap.get(optionId);

        if (!option) {
          console.warn(`⚠️ [SYNC] Option ${optionId} not found`);
          continue;
        }

        // Buscar produto do complemento
        const optionProduct = productsMap.get(option.productId);

        // Pegar preço do contextModifier (primeiro DEFAULT)
        const contextPrice = option.contextModifiers?.find((cm: any) => cm.catalogContext === 'DEFAULT')?.price?.value || 0;
        const contextStatus = option.contextModifiers?.find((cm: any) => cm.catalogContext === 'DEFAULT')?.status || option.status || 'AVAILABLE';

        const complementData = {
          merchant_id: merchantId,
          option_id: option.id,
          name: optionProduct?.name || 'Sem nome',
          description: optionProduct?.description || null,
          imagePath: optionProduct?.imagePath || null,
          context_price: contextPrice,
          status: contextStatus,
          product_id: option.productId
        };

        console.log(`💾 [SYNC] Saving complement: ${complementData.name} (option_id: ${option.id}, price: ${contextPrice})`);

        // Usar upsert com constraint única option_id
        const { error: complementError } = await supabase
          .from('ifood_complements')
          .upsert(complementData, { onConflict: 'option_id' });

        if (complementError) {
          console.error(`❌ [SYNC] Error saving complement ${complementData.name}:`, complementError);
        } else {
          console.log(`✅ [SYNC] Complement saved: ${complementData.name}`);
        }
      }
    }
  }
}


/**
 * Sincronização inicial completa de um merchant
 */
export async function initialSync(merchantId: string, accessToken: string): Promise<void> {
  console.log(`🚀 [SYNC] Starting initial sync for merchant ${merchantId}`);

  try {
    // 1. Sincronizar categorias
    await syncCategories(merchantId, accessToken);

    // 2. Buscar todas as categorias
    const { data: categories } = await supabase
      .from('ifood_categories')
      .select('category_id')
      .eq('merchant_id', merchantId);

    if (!categories || categories.length === 0) {
      console.log(`⚠️ [SYNC] No categories found for merchant ${merchantId}`);
      return;
    }

    // 3. Sincronizar produtos de cada categoria
    for (const category of categories) {
      await syncProducts(merchantId, category.category_id, accessToken);
    }

    console.log(`✅ [SYNC] Initial sync completed for merchant ${merchantId}`);

  } catch (error: any) {
    console.error(`❌ [SYNC] Initial sync failed for merchant ${merchantId}:`, error.message);
    throw error;
  }
}
