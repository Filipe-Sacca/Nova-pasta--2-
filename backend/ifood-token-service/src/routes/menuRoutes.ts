import express from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IFoodProductService } from '../ifoodProductService';

const router = express.Router();

// Interface para dependências
interface MenuRouteDependencies {
  supabase: SupabaseClient;
  supabaseUrl: string;
  supabaseKey: string;
}

export function createMenuRoutes(deps: MenuRouteDependencies) {
  const { supabase, supabaseUrl, supabaseKey } = deps;

  // ============================================================================
  // 📂 CATALOG MANAGEMENT ENDPOINTS
  // ============================================================================

  // Get catalogs for merchant
  router.get('/merchants/:merchantId/catalogs', async (req, res) => {
    try {
      const { merchantId } = req.params;

      console.log(`📚 Getting catalogs for merchant: ${merchantId}`);

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      console.log(`✅ Token found, fetching catalogs from iFood...`);

      // Call iFood API
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`;

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (ifoodResponse.ok) {
        const catalogsData = await ifoodResponse.json();
        console.log(`✅ Found ${catalogsData?.length || 0} catalogs`);

        return res.json({
          success: true,
          data: catalogsData || [],
          total: catalogsData?.length || 0,
          message: `${catalogsData?.length || 0} catálogos encontrados`
        });
      } else {
        const errorText = await ifoodResponse.text();
        console.error(`❌ iFood API failed:`, errorText);

        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

    } catch (error: any) {
      console.error('❌ Error getting catalogs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get catalogs: ' + error.message
      });
    }
  });

  // ============================================================================
  // 📦 PRODUCT MANAGEMENT ENDPOINTS
  // ============================================================================

  // Get all products for a user
  router.get('/products', async (req, res) => {
    try {
      const {
        user_id,
        merchant_id,
        category,
        status,
        search,
        limit = '50',
        offset = '0',
        with_images
      } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing user_id parameter'
        });
      }

      console.log(`📦 Fetching products for user: ${user_id}`);

      // Build query
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('user_id', user_id);

      // Apply filters
      if (merchant_id) {
        query = query.eq('merchant_id', merchant_id);
      }

      if (category) {
        query = query.eq('category', category);
      }

      if (status) {
        query = query.eq('is_active', status);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Apply pagination
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      query = query
        .order('updated_at', { ascending: false })
        .range(offsetNum, offsetNum + limitNum - 1);

      const { data: products, error, count } = await query;

      if (error) {
        console.error('❌ Error fetching products:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch products: ' + error.message
        });
      }

      console.log(`✅ Found ${products?.length || 0} products (total: ${count})`);

      res.json({
        success: true,
        products: products || [],
        total: count || 0,
        limit: limitNum,
        offset: offsetNum,
        has_more: (count || 0) > offsetNum + limitNum
      });
    } catch (error: any) {
      console.error('❌ Error fetching products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch products: ' + error.message
      });
    }
  });

  // Create category
  router.post('/merchants/:merchantId/catalogs/:catalogId/categories', async (req, res) => {
    try {
      const { merchantId, catalogId } = req.params;
      const { name, template, status = 'AVAILABLE', externalCode = '', index = 0 } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: name'
        });
      }

      console.log(`📂 Creating category for merchant: ${merchantId}, catalog: ${catalogId}`);

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token, user_id')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      console.log(`✅ Token found, creating category...`);

      // Call iFood API directly
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`;

      const requestBody: any = {
        name,
        status,
        index,
        template: template === 'PIZZA' ? 'PIZZA' : 'DEFAULT'
      };

      if (externalCode) {
        requestBody.externalCode = externalCode;
      }

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (ifoodResponse.ok) {
        const responseData = await ifoodResponse.json();
        console.log(`✅ Category created successfully`);

        // Save to local database
        try {
          await supabase
            .from('ifood_categories')
            .insert({
              category_id: responseData.id,
              ifood_category_id: responseData.id,
              merchant_id: merchantId,
              catalog_id: catalogId,
              name: name,
              external_code: externalCode,
              status: status,
              index: index,
              template: requestBody.template,
              user_id: tokenData.user_id,
              created_at: new Date().toISOString()
            });
          console.log(`💾 Category saved to local database`);
        } catch (dbError) {
          console.warn(`⚠️ Failed to save category locally:`, dbError);
        }

        return res.json({
          success: true,
          message: 'Category created successfully',
          data: responseData
        });
      } else {
        const errorText = await ifoodResponse.text();
        console.error(`❌ iFood API failed:`, errorText);

        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

    } catch (error: any) {
      console.error('❌ Error creating category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create category: ' + error.message
      });
    }
  });

  // Create category - SIMPLIFIED (auto-fetch catalogId)
  router.post('/merchants/:merchantId/categories', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { name, template, status = 'AVAILABLE', externalCode = '', index = 0 } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: name'
        });
      }

      console.log(`📂 [SIMPLE-CATEGORY] Creating category for merchant: ${merchantId}`);

      // Get access token
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token, user_id')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      console.log(`✅ Token found, fetching catalogId...`);

      // Get catalogId from database
      const { data: catalogData } = await supabase
        .from('ifood_categories')
        .select('catalog_id')
        .eq('merchant_id', merchantId)
        .limit(1)
        .single();

      let catalogId;

      if (catalogData?.catalog_id) {
        catalogId = catalogData.catalog_id;
        console.log(`✅ Found catalogId from database: ${catalogId}`);
      } else {
        // Fetch from iFood API
        console.log(`⚠️ No catalogId in database, fetching from iFood...`);
        const catalogsUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`;

        const catalogsResponse = await fetch(catalogsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!catalogsResponse.ok) {
          throw new Error(`Failed to fetch catalogs: ${catalogsResponse.status}`);
        }

        const catalogsData = await catalogsResponse.json();
        if (!catalogsData || catalogsData.length === 0) {
          throw new Error('No catalogs found');
        }

        catalogId = catalogsData[0].catalogId || catalogsData[0].id;
        console.log(`✅ Found catalogId from iFood API: ${catalogId}`);
      }

      // Call iFood API to create category
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`;

      const requestBody: any = {
        name,
        status,
        index,
        template: template === 'PIZZA' ? 'PIZZA' : 'DEFAULT'
      };

      if (externalCode) {
        requestBody.externalCode = externalCode;
      }

      console.log(`📡 [SIMPLE-CATEGORY] Creating category on iFood:`, requestBody);

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (ifoodResponse.ok) {
        const responseData = await ifoodResponse.json();
        console.log(`✅ Category created successfully on iFood`);

        // Save to local database
        try {
          await supabase
            .from('ifood_categories')
            .insert({
              category_id: responseData.id,
              ifood_category_id: responseData.id,
              merchant_id: merchantId,
              catalog_id: catalogId,
              name: name,
              external_code: externalCode,
              status: status,
              index: index,
              template: requestBody.template,
              user_id: tokenData.user_id,
              created_at: new Date().toISOString()
            });
          console.log(`💾 Category saved to local database`);
        } catch (dbError) {
          console.warn(`⚠️ Failed to save category locally:`, dbError);
        }

        return res.json({
          success: true,
          message: 'Category created successfully',
          data: responseData
        });
      } else {
        const errorText = await ifoodResponse.text();
        console.error(`❌ iFood API failed:`, errorText);

        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

    } catch (error: any) {
      console.error('❌ Error creating category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create category: ' + error.message
      });
    }
  });

  // Get categories for catalog
  router.get('/merchants/:merchantId/catalogs/:catalogId/categories', async (req, res) => {
    try {
      const { merchantId, catalogId } = req.params;

      console.log(`📂 Getting categories for merchant: ${merchantId}, catalog: ${catalogId}`);

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token, user_id')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      console.log(`✅ Token found, fetching categories from iFood...`);

      // Call iFood API
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`;

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (ifoodResponse.ok) {
        const categoriesData = await ifoodResponse.json();
        console.log(`✅ Found ${categoriesData?.length || 0} categories from iFood`);

        return res.json({
          success: true,
          data: categoriesData || [],
          total: categoriesData?.length || 0,
          message: `${categoriesData?.length || 0} categorias encontradas`
        });
      } else {
        const errorText = await ifoodResponse.text();
        console.error(`❌ iFood API failed:`, errorText);

        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

    } catch (error: any) {
      console.error('❌ Error getting categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get categories: ' + error.message
      });
    }
  });

  // OPTIMIZED Smart product sync - Parallel execution with batch operations
  router.post('/merchants/:merchantId/products/smart-sync-working', async (req, res) => {
    const syncStartTime = Date.now();
    console.log('🚀 [OPTIMIZED SYNC] Endpoint hit - ENTRY POINT');

    try {
      const { merchantId } = req.params;
      const { user_id, quick_mode } = req.body;

      console.log(`🔥 [OPTIMIZED] Sync for merchant: ${merchantId}, user: ${user_id}, quick_mode: ${quick_mode}`);

      // Quick mode: just return existing data
      if (quick_mode !== false) {
        console.log('🚀 [WORKING] Quick mode: Returning existing database products');

        const { data: dbProducts, error: dbError } = await supabase
          .from('products')
          .select('*')
          .eq('merchant_id', merchantId);

        if (dbError) {
          throw new Error('Failed to fetch products: ' + dbError.message);
        }

        console.log(`✅ [WORKING] Quick mode: Found ${dbProducts?.length || 0} products`);

        return res.json({
          success: true,
          message: 'Working sync completed (quick mode)',
          merchant_id: merchantId,
          total_products: dbProducts?.length || 0,
          updated_products: 0,
          sync_timestamp: new Date().toISOString(),
          mode: 'quick'
        });
      }

      // Full mode: sync with iFood API
      console.log('🧠 [WORKING] Full mode: Syncing with iFood API...');

      // Get token using client_secret
      console.log('🔑 [WORKING] Getting access token...');
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('No valid token found');
      }
      console.log('✅ [WORKING] Token found, proceeding...');

      // Get catalog ID from iFood
      console.log('📚 [WORKING] Getting catalog ID from iFood...');
      const catalogsUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`;

      const catalogsResponse = await fetch(catalogsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!catalogsResponse.ok) {
        throw new Error(`Failed to fetch catalogs: ${catalogsResponse.status}`);
      }

      const catalogsData = await catalogsResponse.json();
      if (!catalogsData || catalogsData.length === 0) {
        throw new Error('No catalogs found');
      }

      const catalogId = catalogsData[0].catalogId || catalogsData[0].id;
      console.log(`✅ [WORKING] Catalog ID: ${catalogId}`);

      // ============================================================================
      // 🆕 NOVO: Sync de categorias do iFood API (fix para detectar novas categorias)
      // ============================================================================
      console.log('📂 [WORKING] Syncing categories from iFood API...');

      const categoriesUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`;

      const categoriesResponse = await fetch(categoriesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!categoriesResponse.ok) {
        throw new Error(`Failed to fetch categories from iFood: ${categoriesResponse.status}`);
      }

      const ifoodCategoriesData = await categoriesResponse.json();
      console.log(`✅ [WORKING] Found ${ifoodCategoriesData?.length || 0} categories from iFood API`);

      // Get existing categories from database
      const { data: dbCategories } = await supabase
        .from('ifood_categories')
        .select('category_id, name')
        .eq('merchant_id', merchantId);

      const dbCategoryIds = new Set(dbCategories?.map(c => c.category_id) || []);

      // Insert new categories that don't exist in database
      let newCategoriesCount = 0;
      for (const ifoodCategory of ifoodCategoriesData || []) {
        if (!dbCategoryIds.has(ifoodCategory.id)) {
          console.log(`🆕 [WORKING] New category detected: ${ifoodCategory.name}`);

          try {
            await supabase
              .from('ifood_categories')
              .insert({
                category_id: ifoodCategory.id,
                ifood_category_id: ifoodCategory.id,
                merchant_id: merchantId,
                catalog_id: catalogId,
                name: ifoodCategory.name,
                external_code: ifoodCategory.externalCode || '',
                status: ifoodCategory.status || 'AVAILABLE',
                index: ifoodCategory.index || 0,
                template: ifoodCategory.template || 'DEFAULT',
                user_id: user_id,
                created_at: new Date().toISOString()
              });

            newCategoriesCount++;
            console.log(`✅ [WORKING] New category saved: ${ifoodCategory.name}`);
          } catch (insertError) {
            console.error(`❌ [WORKING] Failed to insert category ${ifoodCategory.name}:`, insertError);
          }
        }
      }

      console.log(`📊 [WORKING] Categories sync: ${newCategoriesCount} new, ${dbCategories?.length || 0} existing`);

      // Use the complete list from iFood API for product sync
      const categoriesData = ifoodCategoriesData.map((cat: any) => ({
        category_id: cat.id,
        name: cat.name
      }));

      // ============================================================================
      // 🚀 OTIMIZAÇÃO 1.1: PARALELIZAÇÃO - Fetch ALL categories in parallel
      // ============================================================================
      const categoriesFetchStart = Date.now();
      console.log(`🚀 [OPTIMIZED] Fetching products from ${categoriesData.length} categories IN PARALLEL...`);

      // Initialize timing variables
      let categoriesFetchTime = '0';
      let processingTime = '0';
      let complementsBatchTime = '0';
      let productsComparisonTime = '0';

      // Create promises for all categories
      const categoryPromises = categoriesData.map(async (category: any) => {
        const itemsUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/categories/${category.category_id}/items`;

        try {
          const itemsResponse = await fetch(itemsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            return {
              success: true,
              category,
              itemsData
            };
          } else {
            console.warn(`⚠️ [OPTIMIZED] Failed to fetch items from category ${category.name}: ${itemsResponse.status}`);
            return {
              success: false,
              category,
              itemsData: null
            };
          }
        } catch (error) {
          console.error(`❌ [OPTIMIZED] Error fetching from category ${category.name}:`, error);
          return {
            success: false,
            category,
            itemsData: null
          };
        }
      });

      // Execute ALL category fetches in parallel
      const categoryResults = await Promise.all(categoryPromises);
      const categoriesFetchEnd = Date.now();
      categoriesFetchTime = ((categoriesFetchEnd - categoriesFetchStart) / 1000).toFixed(2);

      console.log(`✅ [OPTIMIZED] All categories fetched in ${categoriesFetchTime}s (parallel execution)`);
      console.log(`📊 [OPTIMIZED] Success: ${categoryResults.filter(r => r.success).length}/${categoryResults.length} categories`);

      // ============================================================================
      // 🚀 OTIMIZAÇÃO 1.2 & 1.3: BATCH ACCUMULATION - Process all results
      // ============================================================================
      const processingStart = Date.now();
      console.log(`⚙️ [OPTIMIZED] Processing category results and accumulating for batch operations...`);

      let allIfoodProducts: any[] = [];
      const allComplementsToUpsert: any[] = [];

      for (const result of categoryResults) {
        if (!result.success || !result.itemsData) continue;

        const { category, itemsData } = result;

        if (itemsData && itemsData.items && itemsData.items.length > 0) {
          console.log(`✅ [OPTIMIZED] Processing ${itemsData.items.length} products from ${category.name}`);

          // Create Maps for lookups
          const optionGroupsMap = new Map();
          const productsMap = new Map();

          // Map optionGroups
          if (itemsData.optionGroups && itemsData.optionGroups.length > 0) {
            for (const optionGroup of itemsData.optionGroups) {
              optionGroupsMap.set(optionGroup.id, optionGroup);
            }
          }

          // Map products
          if (itemsData.products && itemsData.products.length > 0) {
            for (const product of itemsData.products) {
              productsMap.set(product.id, product);
            }
          }

          // Process products
          for (const item of itemsData.items) {
            const product = productsMap.get(item.productId);

            // Collect option_ids
            const optionIds: string[] = [];

            if (product && product.optionGroups && product.optionGroups.length > 0) {
              for (const productOptionGroup of product.optionGroups) {
                const optionGroup = optionGroupsMap.get(productOptionGroup.id);

                if (optionGroup && optionGroup.optionIds && optionGroup.optionIds.length > 0) {
                  optionIds.push(...optionGroup.optionIds);
                }
              }
            }

            allIfoodProducts.push({
              id: item.id,
              productId: product?.id || item.productId,
              name: product?.name || item.name || 'Unknown',
              description: product?.description || item.description || null,
              status: item.status,
              price: item.price?.value || 0,
              imagePath: product?.imagePath || item.imagePath || null,
              category: category.name,
              category_id: category.category_id,
              option_ids: optionIds.length > 0 ? optionIds : null
            });
          }

          // ============================================================================
          // 🚀 OTIMIZAÇÃO 1.2: ACCUMULATE complements for batch insert
          // ============================================================================
          if (itemsData.options && itemsData.options.length > 0) {
            for (const option of itemsData.options) {
              const optionProduct = productsMap.get(option.productId);

              const contextPrice = option.contextModifiers?.find((cm: any) => cm.catalogContext === 'DEFAULT')?.price?.value || 0;
              const contextStatus = option.contextModifiers?.find((cm: any) => cm.catalogContext === 'DEFAULT')?.status || option.status || 'AVAILABLE';

              allComplementsToUpsert.push({
                merchant_id: merchantId,
                option_id: option.id,
                name: optionProduct?.name || 'Sem nome',
                description: optionProduct?.description || null,
                imagePath: optionProduct?.imagePath || null,
                context_price: contextPrice,
                status: contextStatus,
                product_id: option.productId
              });
            }
          }
        }
      }

      const processingEnd = Date.now();
      processingTime = ((processingEnd - processingStart) / 1000).toFixed(2);

      console.log(`✅ [OPTIMIZED] Processing completed in ${processingTime}s`);
      console.log(`📊 [OPTIMIZED] Total products: ${allIfoodProducts.length}`);
      console.log(`📊 [OPTIMIZED] Total complements: ${allComplementsToUpsert.length}`);

      // ============================================================================
      // 🚀 OTIMIZAÇÃO 1.2: BATCH INSERT COMPLEMENTS
      // ============================================================================
      if (allComplementsToUpsert.length > 0) {
        const complementsBatchStart = Date.now();
        console.log(`💾 [OPTIMIZED] Batch inserting ${allComplementsToUpsert.length} complements...`);

        const BATCH_SIZE = 1000;
        let complementsInserted = 0;
        let complementsErrors = 0;

        for (let i = 0; i < allComplementsToUpsert.length; i += BATCH_SIZE) {
          const batch = allComplementsToUpsert.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(allComplementsToUpsert.length / BATCH_SIZE);

          console.log(`💾 [OPTIMIZED] Inserting batch ${batchNum}/${totalBatches} (${batch.length} complements)...`);

          const { error: complementError } = await supabase
            .from('ifood_complements')
            .upsert(batch, { onConflict: 'option_id' });

          if (complementError) {
            console.error(`❌ [OPTIMIZED] Error in batch ${batchNum}:`, complementError);
            complementsErrors += batch.length;
          } else {
            complementsInserted += batch.length;
          }
        }

        const complementsBatchEnd = Date.now();
        complementsBatchTime = ((complementsBatchEnd - complementsBatchStart) / 1000).toFixed(2);

        console.log(`✅ [OPTIMIZED] Complements batch insert completed in ${complementsBatchTime}s`);
        console.log(`📊 [OPTIMIZED] Inserted: ${complementsInserted}, Errors: ${complementsErrors}`);
      }

      // ============================================================================
      // 🚀 OTIMIZAÇÃO 1.3: BATCH INSERT/UPDATE PRODUCTS
      // ============================================================================
      const productsComparisonStart = Date.now();
      console.log(`⚙️ [OPTIMIZED] Comparing products with database...`);

      // Get current products from database
      const { data: dbProducts, error: dbError } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId);

      if (dbError) {
        throw new Error('Failed to fetch products from database: ' + dbError.message);
      }

      console.log(`📊 [OPTIMIZED] Products in database: ${dbProducts?.length || 0}`);
      console.log(`📊 [OPTIMIZED] Products from iFood: ${allIfoodProducts.length}`);

      // Create Map for fast lookup
      const dbProductsMap = new Map();
      if (dbProducts) {
        for (const dbProduct of dbProducts) {
          dbProductsMap.set(dbProduct.item_id, dbProduct);
        }
      }

      // Accumulate products for batch operations
      const productsToInsert: any[] = [];
      const productsToUpdate: any[] = [];
      const changesDetected: any[] = [];

      for (const ifoodProduct of allIfoodProducts) {
        const dbProduct = dbProductsMap.get(ifoodProduct.id);

        if (dbProduct) {
          // PRODUTO JÁ EXISTE - Check if needs update
          let needsUpdate = false;
          const updates: any = {
            id: dbProduct.id, // Needed for update
            item_id: dbProduct.item_id // Needed for update
          };

          // Compare status
          const ifoodStatus = ifoodProduct.status === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE';
          if (dbProduct.is_active !== ifoodStatus) {
            updates.is_active = ifoodStatus;
            needsUpdate = true;
          }

          // Compare price
          if (dbProduct.price !== ifoodProduct.price) {
            updates.price = ifoodProduct.price;
            needsUpdate = true;
          }

          // Compare image
          if (dbProduct.imagePath !== ifoodProduct.imagePath) {
            updates.imagePath = ifoodProduct.imagePath;
            needsUpdate = true;
          }

          // Compare description
          if (dbProduct.description !== ifoodProduct.description) {
            updates.description = ifoodProduct.description;
            needsUpdate = true;
          }

          if (needsUpdate) {
            updates.updated_at = new Date().toISOString();
            productsToUpdate.push(updates);
            changesDetected.push({
              product_id: dbProduct.id,
              name: dbProduct.name,
              action: 'updated',
              changes: updates
            });
          }
        } else {
          // PRODUTO NÃO EXISTE - Add to insert list
          const newProduct = {
            user_id: user_id,
            merchant_id: merchantId,
            item_id: ifoodProduct.id,
            product_id: ifoodProduct.productId,
            name: ifoodProduct.name,
            category: ifoodProduct.category,
            price: ifoodProduct.price,
            description: ifoodProduct.description,
            is_active: ifoodProduct.status === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE',
            imagePath: ifoodProduct.imagePath,
            ifood_category_id: ifoodProduct.category_id,
            ifood_category_name: ifoodProduct.category,
            option_ids: ifoodProduct.option_ids || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          productsToInsert.push(newProduct);
          changesDetected.push({
            product_id: ifoodProduct.id,
            name: ifoodProduct.name,
            action: 'created'
          });
        }
      }

      const productsComparisonEnd = Date.now();
      productsComparisonTime = ((productsComparisonEnd - productsComparisonStart) / 1000).toFixed(2);

      console.log(`✅ [OPTIMIZED] Product comparison completed in ${productsComparisonTime}s`);
      console.log(`📊 [OPTIMIZED] To insert: ${productsToInsert.length}, To update: ${productsToUpdate.length}`);

      // ============================================================================
      // BATCH INSERT NEW PRODUCTS
      // ============================================================================
      let createdProducts = 0;
      if (productsToInsert.length > 0) {
        const insertStart = Date.now();
        console.log(`💾 [OPTIMIZED] Batch inserting ${productsToInsert.length} new products...`);

        const BATCH_SIZE = 1000;

        for (let i = 0; i < productsToInsert.length; i += BATCH_SIZE) {
          const batch = productsToInsert.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(productsToInsert.length / BATCH_SIZE);

          console.log(`💾 [OPTIMIZED] Inserting batch ${batchNum}/${totalBatches} (${batch.length} products)...`);

          const { error: insertError } = await supabase
            .from('products')
            .insert(batch);

          if (insertError) {
            console.error(`❌ [OPTIMIZED] Error in insert batch ${batchNum}:`, insertError);
          } else {
            createdProducts += batch.length;
          }
        }

        const insertEnd = Date.now();
        const insertTime = ((insertEnd - insertStart) / 1000).toFixed(2);
        console.log(`✅ [OPTIMIZED] Batch insert completed in ${insertTime}s - ${createdProducts} products created`);
      }

      // ============================================================================
      // BATCH UPDATE EXISTING PRODUCTS
      // ============================================================================
      let updatedProducts = 0;
      if (productsToUpdate.length > 0) {
        const updateStart = Date.now();
        console.log(`💾 [OPTIMIZED] Batch updating ${productsToUpdate.length} products...`);

        // Supabase doesn't support native batch updates, so we use upsert with unique constraint
        // Or we can do sequential updates (still faster because of accumulated comparison)
        for (const update of productsToUpdate) {
          const { id, ...updateFields } = update;

          const { error: updateError } = await supabase
            .from('products')
            .update(updateFields)
            .eq('id', id);

          if (!updateError) {
            updatedProducts++;
          } else {
            console.error(`❌ [OPTIMIZED] Error updating product ${id}:`, updateError);
          }
        }

        const updateEnd = Date.now();
        const updateTime = ((updateEnd - updateStart) / 1000).toFixed(2);
        console.log(`✅ [OPTIMIZED] Batch update completed in ${updateTime}s - ${updatedProducts} products updated`);
      }

      console.log(`🎉 [OPTIMIZED] Products sync completed - ${createdProducts} created, ${updatedProducts} updated`);

      // ============================================================================
      // 📊 FINAL PERFORMANCE METRICS
      // ============================================================================
      const syncEndTime = Date.now();
      const totalSyncTime = ((syncEndTime - syncStartTime) / 1000).toFixed(2);

      const performanceMetrics = {
        total_time: `${totalSyncTime}s`,
        categories_fetch_time: categoriesFetchTime ? `${categoriesFetchTime}s` : 'N/A',
        processing_time: processingTime ? `${processingTime}s` : 'N/A',
        complements_time: complementsBatchTime || '0s',
        products_comparison_time: productsComparisonTime || '0s',
        categories_count: categoriesData.length,
        parallel_execution: true
      };

      console.log(`\n${'='.repeat(80)}`);
      console.log(`🎉 [OPTIMIZED SYNC] COMPLETED SUCCESSFULLY`);
      console.log(`${'='.repeat(80)}`);
      console.log(`⏱️  Total Time: ${totalSyncTime}s`);
      console.log(`📂 Categories: ${categoriesData.length} (fetched in parallel: ${categoriesFetchTime}s)`);
      console.log(`🍴 Complements: ${allComplementsToUpsert.length} (batched)`);
      console.log(`📦 Products: ${allIfoodProducts.length} from iFood`);
      console.log(`   ✅ Created: ${createdProducts}`);
      console.log(`   🔄 Updated: ${updatedProducts}`);
      console.log(`   📊 Changes: ${changesDetected.length}`);
      console.log(`${'='.repeat(80)}\n`);

      return res.json({
        success: true,
        message: 'Optimized sync completed successfully',
        merchant_id: merchantId,
        total_products: allIfoodProducts.length,
        created_products: createdProducts,
        updated_products: updatedProducts,
        changes_detected: changesDetected.length,
        sync_timestamp: new Date().toISOString(),
        mode: 'full',
        optimizations: {
          parallel_categories: true,
          batch_complements: true,
          batch_products: true
        },
        performance: performanceMetrics,
        details: {
          ifood_products: allIfoodProducts.length,
          database_products: dbProducts?.length || 0,
          created: createdProducts,
          updated: updatedProducts,
          complements_synced: allComplementsToUpsert.length,
          changes: changesDetected
        }
      });

    } catch (error: any) {
      console.error('❌ [WORKING SYNC] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        mode: 'error'
      });
    }
  });


  // ============================================================================
  // 🔄 ITEM STATUS MANAGEMENT
  // ============================================================================

  // Update item status - Simple and Direct
  router.patch('/merchants/:merchantId/items/status', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { itemId, status } = req.body;

      console.log(`🔄 [SIMPLE] Updating item status for merchant: ${merchantId}`);
      console.log(`📦 [SIMPLE] Request:`, { itemId, status });

      // Validate required fields
      if (!itemId || !status) {
        return res.status(400).json({
          success: false,
          error: 'itemId and status are required'
        });
      }

      // Step 1: Get access token using fixed client_secret
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      console.log(`🔑 [SIMPLE] Searching token by client_secret: ${TARGET_CLIENT_SECRET.substring(0, 10)}...`);

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ [SIMPLE] Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      console.log(`✅ [SIMPLE] Token found, making request to iFood...`);

      // Step 2: Call iFood API
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/items/status`;
      const ifoodPayload = { itemId, status };

      console.log(`📡 [SIMPLE] iFood API URL: ${ifoodUrl}`);
      console.log(`📦 [SIMPLE] iFood Payload:`, ifoodPayload);

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ifoodPayload)
      });

      console.log(`📡 [SIMPLE] iFood API Response Status: ${ifoodResponse.status}`);

      if (ifoodResponse.ok) {
        console.log(`✅ [SIMPLE] iFood API success - updating local database...`);

        // Step 3: Update local database
        const { error: dbError } = await supabase
          .from('products')
          .update({
            is_active: status,
            updated_at: new Date().toISOString()
          })
          .eq('item_id', itemId)
          .eq('merchant_id', merchantId);

        if (dbError) {
          console.error(`⚠️ [SIMPLE] Database update failed:`, dbError);
        } else {
          console.log(`✅ [SIMPLE] Database updated successfully`);
        }

        return res.json({
          success: true,
          message: 'Item status updated successfully',
          itemId,
          status,
          ifoodStatus: ifoodResponse.status
        });

      } else {
        const errorText = await ifoodResponse.text();
        console.error(`❌ [SIMPLE] iFood API failed:`, errorText);

        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`,
          itemId,
          status
        });
      }

    } catch (error: any) {
      console.error('❌ [SIMPLE] Fatal error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error: ' + error.message
      });
    }
  });

  // ============================================================================
  // 🍕 ITEM MANAGEMENT ENDPOINTS
  // ============================================================================

  // Create or update item (PUT)
  router.put('/merchants/:merchantId/items', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const itemData = req.body;

      console.log(`🍕 Creating/updating item for merchant: ${merchantId}`);

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      console.log(`✅ Token found, making request to iFood...`);

      // Call iFood API
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/items`;

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData)
      });

      if (ifoodResponse.ok) {
        const responseData = await ifoodResponse.json();
        console.log(`✅ Item created/updated successfully`);

        return res.json({
          success: true,
          message: 'Item created/updated successfully',
          data: responseData
        });
      } else {
        const errorText = await ifoodResponse.text();
        console.error(`❌ iFood API failed:`, errorText);

        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

    } catch (error: any) {
      console.error('❌ Error creating/updating item:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error: ' + error.message
      });
    }
  });

  // Update item price (PATCH)
  router.patch('/merchants/:merchantId/items/price', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { itemId, price } = req.body;

      console.log(`💰 Updating item price for merchant: ${merchantId}, item: ${itemId}`);

      // Validate required fields
      if (!itemId || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'itemId and price are required'
        });
      }

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      console.log(`✅ Token found, making request to iFood...`);

      // Call iFood API
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/items/price`;
      const ifoodPayload = { itemId, price };

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ifoodPayload)
      });

      if (ifoodResponse.ok) {
        console.log(`✅ Item price updated successfully`);

        // Update local database
        const { error: dbError } = await supabase
          .from('products')
          .update({
            price: price,
            updated_at: new Date().toISOString()
          })
          .eq('item_id', itemId)
          .eq('merchant_id', merchantId);

        if (dbError) {
          console.error(`⚠️ Database update failed:`, dbError);
        }

        return res.json({
          success: true,
          message: 'Item price updated successfully',
          itemId,
          price
        });
      } else {
        const errorText = await ifoodResponse.text();
        console.error(`❌ iFood API failed:`, errorText);

        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

    } catch (error: any) {
      console.error('❌ Error updating item price:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error: ' + error.message
      });
    }
  });

  // ============================================================================
  // 🎛️ OPTIONS/COMPLEMENTOS MANAGEMENT ENDPOINTS
  // ============================================================================

  // Update option price (PATCH)
  router.patch('/merchants/:merchantId/options/price', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { optionId, price } = req.body;

      console.log(`💰 [OPTIONS-PRICE] Updating option price for merchant: ${merchantId}, option: ${optionId}`);
      console.log(`💰 [OPTIONS-PRICE] Received price:`, price, `(type: ${typeof price})`);

      // Validate required fields
      if (!optionId || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'optionId and price are required'
        });
      }

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ [OPTIONS-PRICE] Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      console.log(`✅ [OPTIONS-PRICE] Token found, preparing iFood request...`);

      // Convert price to iFood format { value, originalValue }
      const priceValue = typeof price === 'number' ? price : (price.value || 0);
      const ifoodPayload = {
        optionId,
        price: {
          value: priceValue,
          originalValue: priceValue
        }
      };

      console.log(`📦 [OPTIONS-PRICE] iFood payload:`, JSON.stringify(ifoodPayload, null, 2));

      // Call iFood API
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/options/price`;
      console.log(`📡 [OPTIONS-PRICE] Calling iFood API:`, ifoodUrl);

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ifoodPayload)
      });

      console.log(`📡 [OPTIONS-PRICE] iFood response status:`, ifoodResponse.status);

      if (ifoodResponse.ok) {
        console.log(`✅ [OPTIONS-PRICE] iFood API success - updating local database...`);

        // Update local database
        const { error: dbError } = await supabase
          .from('ifood_complements')
          .update({
            context_price: priceValue,
            updated_at: new Date().toISOString()
          })
          .eq('option_id', optionId);

        if (dbError) {
          console.error(`⚠️ [OPTIONS-PRICE] Database update failed:`, dbError);
        } else {
          console.log(`✅ [OPTIONS-PRICE] Database updated successfully`);
        }

        return res.json({
          success: true,
          message: 'Option price updated successfully',
          optionId,
          price: priceValue
        });
      } else {
        const errorText = await ifoodResponse.text();
        console.error(`❌ [OPTIONS-PRICE] iFood API failed:`, errorText);

        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

    } catch (error: any) {
      console.error('❌ [OPTIONS-PRICE] Fatal error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error: ' + error.message
      });
    }
  });

  // Update option status (PATCH)
  router.patch('/merchants/:merchantId/options/status', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { optionId, status } = req.body;

      console.log(`🔄 [OPTIONS-STATUS] Updating option status for merchant: ${merchantId}, option: ${optionId}`);
      console.log(`🔄 [OPTIONS-STATUS] New status:`, status);

      // Validate required fields
      if (!optionId || !status) {
        return res.status(400).json({
          success: false,
          error: 'optionId and status are required'
        });
      }

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ [OPTIONS-STATUS] Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      console.log(`✅ [OPTIONS-STATUS] Token found, making request to iFood...`);

      // Call iFood API
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/options/status`;
      const ifoodPayload = { optionId, status };

      console.log(`📦 [OPTIONS-STATUS] iFood payload:`, JSON.stringify(ifoodPayload, null, 2));
      console.log(`📡 [OPTIONS-STATUS] Calling iFood API:`, ifoodUrl);

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ifoodPayload)
      });

      console.log(`📡 [OPTIONS-STATUS] iFood response status:`, ifoodResponse.status);

      if (ifoodResponse.ok) {
        console.log(`✅ [OPTIONS-STATUS] iFood API success - updating local database...`);

        // Update local database
        const { error: dbError } = await supabase
          .from('ifood_complements')
          .update({
            status: status,
            updated_at: new Date().toISOString()
          })
          .eq('option_id', optionId);

        if (dbError) {
          console.error(`⚠️ [OPTIONS-STATUS] Database update failed:`, dbError);
        } else {
          console.log(`✅ [OPTIONS-STATUS] Database updated successfully`);
        }

        return res.json({
          success: true,
          message: 'Option status updated successfully',
          optionId,
          status
        });
      } else {
        const errorText = await ifoodResponse.text();
        console.error(`❌ [OPTIONS-STATUS] iFood API failed:`, errorText);

        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

    } catch (error: any) {
      console.error('❌ [OPTIONS-STATUS] Fatal error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error: ' + error.message
      });
    }
  });

  // ============================================================================
  // 🔄 GET PRODUCT AND SYNC TO DATABASE
  // ============================================================================

  router.get('/merchants/:merchantId/products/:productId', async (req, res) => {
    try {
      const { merchantId, productId } = req.params;
      const itemId = productId; // productId param is actually the itemId from frontend

      console.log(`🔄 Getting item ${itemId} from merchant ${merchantId} and syncing to database...`);

      // Get access token
      const TARGET_CLIENT_SECRET = 'rtbqalxiidqz1uziaxq7web8c0mdu95dzpvg369dyknfs132njsffzuagzjuhwj8zs14g5xtlp0hzxd26j54hdlg4ghfylb93o3';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token, user_id')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error(`❌ Token not found:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      const accessToken = tokenData.access_token;
      console.log(`✅ Token found, fetching product from iFood...`);

      // Get catalog ID from ifood_categories (merchant can have multiple categories with same catalog_id)
      const { data: catalogData } = await supabase
        .from('ifood_categories')
        .select('catalog_id')
        .eq('merchant_id', merchantId)
        .limit(1)
        .single();

      if (!catalogData?.catalog_id) {
        return res.status(404).json({
          success: false,
          error: 'Catalog not found for merchant'
        });
      }

      const catalogId = catalogData.catalog_id;
      console.log(`✅ Catalog ID: ${catalogId}`);

      // Fetch product from iFood API - flat endpoint returns complete product data
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/items/${itemId}/flat`;
      console.log(`📡 Calling iFood API: ${ifoodUrl}`);

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!ifoodResponse.ok) {
        const errorText = await ifoodResponse.text();
        console.error(`❌ iFood API error:`, errorText);
        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

      const productFromIfood = await ifoodResponse.json();
      console.log('📦 Product fetched from iFood:');
      console.log(JSON.stringify(productFromIfood, null, 2));

      // Extract data from correct structure
      const itemData = productFromIfood.item || {};
      const productData = productFromIfood.products?.[0] || {};
      const priceValue = itemData.price?.value || itemData.price?.originalValue || 0;

      console.log('🔍 Extracted data:');
      console.log('  - Item:', itemData);
      console.log('  - Product:', productData);
      console.log('  - Price:', priceValue);

      // Save to database - matching exact schema
      try {
        const productToSave = {
          user_id: tokenData.user_id,
          merchant_id: merchantId,
          item_id: itemData.id || itemId,
          product_id: productData.id || itemData.productId || itemId,
          name: productData.name || 'Unknown Product',
          category: productData.category || null,
          price: priceValue,
          description: productData.description || null,
          is_active: itemData.status || 'AVAILABLE',
          imagePath: productData.imagePath || null,
          ifood_category_id: itemData.categoryId || null,
          ifood_category_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('💾 Salvando produto no banco:', productToSave);

        // Insert product (without upsert since there's no unique constraint on item_id)
        const { data: savedProduct, error: saveError } = await supabase
          .from('products')
          .insert(productToSave)
          .select()
          .single();

        if (saveError) {
          console.error('❌ Error saving to database:', saveError);
          return res.status(500).json({
            success: false,
            error: 'Failed to save product to database',
            details: saveError
          });
        }

        console.log('✅ Product saved to database:', savedProduct);

        return res.json({
          success: true,
          message: 'Product synced successfully',
          data: {
            ifood: productFromIfood,
            database: savedProduct
          }
        });

      } catch (dbError: any) {
        console.error('❌ Database error:', dbError);
        return res.status(500).json({
          success: false,
          error: 'Database operation failed',
          details: dbError.message
        });
      }

    } catch (error: any) {
      console.error('❌ Error syncing product:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error: ' + error.message
      });
    }
  });

  return router;
}

export default createMenuRoutes;