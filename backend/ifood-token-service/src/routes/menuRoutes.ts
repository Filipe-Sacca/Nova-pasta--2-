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
  // 📦 PRODUCT MANAGEMENT ENDPOINTS
  // ============================================================================

  // Sync products
  router.post('/products', async (req, res) => {
    try {
      const { user_id, merchant_id } = req.body;
      if (!user_id || !merchant_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing user_id or merchant_id'
        });
      }

      console.log(`📦 Product sync for merchant: ${merchant_id}, user: ${user_id}`);
      const productService = new IFoodProductService(supabaseUrl, supabaseKey);
      const result = await productService.syncProducts(user_id, merchant_id);
      res.json(result);
    } catch (error: any) {
      console.error('❌ Error syncing products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync products: ' + error.message
      });
    }
  });

  // Get all products for a user
  router.get('/products', async (req, res) => {
    try {
      const { user_id, with_images } = req.query;
      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing user_id parameter'
        });
      }

      console.log(`📦 Fetching products for user: ${user_id}`);

      // Get products from database
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user_id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching products:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch products: ' + error.message
        });
      }

      console.log(`✅ Found ${products?.length || 0} products for user ${user_id}`);
      res.json({
        success: true,
        products: products || [],
        total: products?.length || 0
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
  router.post('/merchants/:merchantId/categories', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { user_id, name, template } = req.body;

      console.log(`📂 Creating category for merchant: ${merchantId}`);
      const productService = new IFoodProductService(supabaseUrl, supabaseKey);
      const result = await productService.createCategory(user_id, merchantId, {
        name,
        template,
        status: 'AVAILABLE',
        externalCode: '',
        index: 0
      });
      res.json(result);
    } catch (error: any) {
      console.error('❌ Error creating category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create category: ' + error.message
      });
    }
  });

  // Get categories for merchant
  router.get('/merchants/:merchantId/categories', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { user_id } = req.query;

      console.log(`📂 Getting categories for merchant: ${merchantId}, user: ${user_id}`);

      // Buscar categorias sincronizadas do banco de dados
      const { data: categories, error } = await supabase
        .from('ifood_categories')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('user_id', user_id)
        .order('name');

      if (error) {
        console.error('❌ Erro ao buscar categorias:', error);
        throw error;
      }

      console.log(`📊 Encontradas ${categories?.length || 0} categorias`);
      res.json({
        success: true,
        data: categories || [],
        message: `${categories?.length || 0} categorias encontradas`
      });
    } catch (error: any) {
      console.error('❌ Error getting categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get categories: ' + error.message
      });
    }
  });

  // Manual product sync for specific merchant
  router.post('/merchants/:merchantId/products/sync', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { user_id } = req.body;

      console.log(`🔄 Manual product sync for merchant: ${merchantId}`);
      const productService = new IFoodProductService(supabaseUrl, supabaseKey);
      const result = await productService.syncProducts(user_id, merchantId);
      res.json(result);
    } catch (error: any) {
      console.error('❌ Error in manual product sync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed manual product sync: ' + error.message
      });
    }
  });

  // Smart product sync with comparison and auto-update
  router.post('/merchants/:merchantId/products/smart-sync', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { user_id } = req.body;

      console.log(`🧠 Smart product sync for merchant: ${merchantId}`);
      console.log(`👤 User ID: ${user_id}`);

      // Initialize services
      const productService = new IFoodProductService(supabaseUrl, supabaseKey);

      // STEP 1: Get products from iFood API
      console.log('🔍 [STEP 1] Fetching products from iFood API...');

      // Get token first
      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', user_id)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('No valid token found for user');
      }

      // Get categories first
      console.log('🔍 [STEP 1A] Fetching categories from ifood_categories table...');
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('ifood_categories')
        .select('category_id, name, user_id')
        .eq('merchant_id', merchantId);

      // Initialize variables
      let ifoodResult;
      let allIfoodProducts: any[] = [];
      let totalProducts = 0;

      if (categoriesError || !categoriesData || categoriesData.length === 0) {
        console.log('📦 No categories found, skipping iFood fetch and working with existing database products...');
        ifoodResult = {
          success: true,
          total_products: 0,
          new_products: 0,
          updated_products: 0,
          message: 'No categories found - working with existing database products only'
        };
        console.log(`⚠️ [STEP 1] No iFood data to compare - categories table is empty`);
      } else {
        console.log(`📋 [STEP 1A] Found ${categoriesData.length} categories`);

        // STEP 1A.5: Get catalog ID first
        console.log('🔍 [STEP 1A.5] Fetching catalog ID...');
        let catalogId;

        try {
          const catalogsUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`;
          const catalogsResponse = await fetch(catalogsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (catalogsResponse.ok) {
            const catalogsData = await catalogsResponse.json();
            if (catalogsData && catalogsData.length > 0) {
              catalogId = catalogsData[0].catalogId || catalogsData[0].id;
              console.log(`✅ [STEP 1A.5] Catalog ID found: ${catalogId}`);
            } else {
              throw new Error('No catalogs found');
            }
          } else {
            throw new Error(`Failed to fetch catalogs: ${catalogsResponse.status}`);
          }
        } catch (catalogError: any) {
          console.error('❌ [STEP 1A.5] Error fetching catalog ID:', catalogError.message);
          throw new Error('Cannot proceed without catalog ID');
        }

        for (const category of categoriesData) {
          console.log(`🔍 [STEP 1B] Fetching products from category: ${category.name}`);

          try {
            // Use the correct iFood endpoint with catalog ID
            const itemsUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories/${category.category_id}`;

            console.log(`🔥 [JSON REQUEST] URL: ${itemsUrl}`);
            console.log(`🔥 [JSON REQUEST] Method: GET`);
            console.log(`🔥 [JSON REQUEST] Headers:`, {
              'Authorization': `Bearer ${tokenData.access_token.substring(0, 20)}...`,
              'Content-Type': 'application/json'
            });

            const itemsResponse = await fetch(itemsUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
              }
            });

            console.log(`🔥 [JSON RESPONSE] Status: ${itemsResponse.status}`);
            console.log(`🔥 [JSON RESPONSE] Status Text: ${itemsResponse.statusText}`);

            if (itemsResponse.ok) {
              const itemsData = await itemsResponse.json();
              console.log(`🔥 [JSON RESPONSE DATA] Complete Response from iFood API for ${category.name}:`);
              console.log(JSON.stringify(itemsData, null, 2));

              // Extract products from the correct structure
              const items = itemsData?.items || [];
              const products = itemsData?.products || [];
              console.log(`✅ Category ${category.name}: ${items.length} items, ${products.length} products`);

              // Process items (these are the menu items with status, price, etc.)
              if (items && Array.isArray(items) && items.length > 0) {
                const itemsWithProductData = items.map((item: any) => {
                  const correspondingProduct = products.find((p: any) => p.id === item.productId);
                  return {
                    id: item.id,
                    name: item.name || correspondingProduct?.name || 'Unknown Product',
                    description: item.description || correspondingProduct?.description || '',
                    status: item.status,
                    price: item.price,
                    productId: item.productId,
                    imagePath: item.imagePath || correspondingProduct?.imagePath || '',
                    categoryId: item.categoryId,
                    categoryName: category.name
                  };
                });

                allIfoodProducts.push(...itemsWithProductData);
                totalProducts += itemsWithProductData.length;
                console.log(`📦 Processed ${itemsWithProductData.length} products from category ${category.name}`);
              }
            } else {
              const errorText = await itemsResponse.text();
              console.log(`⚠️ Failed to fetch items for category ${category.name}: ${itemsResponse.status}`);
              console.log(`🔥 [DEBUG] Error response:`, errorText);
            }
          } catch (error: any) {
            console.error(`❌ Error fetching category ${category.name}:`, error);
          }
        }

        console.log(`✅ [STEP 1] Fetched ${totalProducts} products from iFood using correct endpoint`);

        ifoodResult = {
          success: true,
          total_products: totalProducts,
          new_products: 0,
          updated_products: 0,
          data: allIfoodProducts
        };
      }

      // STEP 2: Get products from database
      console.log('🗄️ [STEP 2] Fetching products from database...');
      const { data: dbProducts, error: dbError } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('user_id', user_id);

      if (dbError) {
        throw new Error('Failed to fetch products from database: ' + dbError.message);
      }

      console.log(`📊 [STEP 2] Found ${dbProducts?.length || 0} products in database`);

      // STEP 3: Compare and update - iFood is source of truth
      console.log('🔍 [STEP 3] Comparing iFood vs Database - iFood is source of truth...');
      let updatedProducts = 0;
      let changesDetected: any[] = [];

      // Create a map of iFood products for easy lookup using item.id
      const ifoodProductsMap = new Map();
      allIfoodProducts.forEach(ifoodProduct => {
        ifoodProductsMap.set(ifoodProduct.id, ifoodProduct);
      });

      // Compare each database product with iFood data
      console.log('🔍 [DEBUG] Starting product comparison...');
      console.log(`🔍 [DEBUG] Database products: ${dbProducts?.length || 0}`);
      console.log(`🔍 [DEBUG] iFood products in map: ${ifoodProductsMap.size}`);

      for (const dbProduct of dbProducts || []) {
        console.log(`🔍 [DEBUG] Checking DB product: ${dbProduct.name} (item_id: ${dbProduct.item_id})`);

        // Use item_id to match with iFood item.id
        const ifoodProduct = ifoodProductsMap.get(dbProduct.item_id);

        if (!ifoodProduct) {
          console.log(`⚠️ [DEBUG] No iFood match found for DB product ${dbProduct.name} with item_id ${dbProduct.item_id}`);
          console.log(`🔍 [DEBUG] Available iFood IDs: ${Array.from(ifoodProductsMap.keys()).slice(0, 5).join(', ')}...`);
          continue;
        }

        console.log(`✅ [DEBUG] Found match for ${dbProduct.name}: ${ifoodProduct.name} (status: ${ifoodProduct.status})`);

        let needsUpdate = false;
        const updates: any = {};

        // Compare status (is_active)
        const ifoodStatus = ifoodProduct.status === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE';
        if (dbProduct.is_active !== ifoodStatus) {
          console.log(`📊 Product ${dbProduct.name}: Status changed from ${dbProduct.is_active} to ${ifoodStatus}`);
          updates.is_active = ifoodStatus;
          needsUpdate = true;
        }

        // Compare price
        const ifoodPrice = ifoodProduct.price?.value || 0;
        if (dbProduct.price !== ifoodPrice) {
          console.log(`💰 Product ${dbProduct.name}: Price changed from R$ ${dbProduct.price} to R$ ${ifoodPrice}`);
          updates.price = ifoodPrice;
          needsUpdate = true;
        }

        // Compare name
        if (dbProduct.name !== ifoodProduct.name) {
          console.log(`📝 Product ${dbProduct.name}: Name changed to ${ifoodProduct.name}`);
          updates.name = ifoodProduct.name;
          needsUpdate = true;
        }

        // Compare imagePath - FIXED VERSION
        const ifoodImagePath = ifoodProduct.imagePath || null;
        console.log(`🔍 [DEBUG] Product ${dbProduct.name} imagePath comparison:`);
        console.log(`   DB: ${dbProduct.imagePath}`);
        console.log(`   iFood: ${ifoodImagePath}`);
        console.log(`   Equal: ${dbProduct.imagePath === ifoodImagePath}`);

        if (dbProduct.imagePath !== ifoodImagePath) {
          console.log(`🖼️ Product ${dbProduct.name}: Image path changed from ${dbProduct.imagePath} to ${ifoodImagePath}`);
          updates.imagePath = ifoodImagePath;
          needsUpdate = true;
        }

        // Update if needed
        if (needsUpdate) {
          try {
            const { error: updateError } = await supabase
              .from('products')
              .update({
                ...updates,
                updated_at: new Date().toISOString()
              })
              .eq('id', dbProduct.id);

            if (updateError) {
              console.error(`❌ Failed to update product ${dbProduct.name}:`, updateError);
            } else {
              console.log(`✅ Updated product: ${dbProduct.name}`);
              updatedProducts++;
              changesDetected.push({
                product_id: dbProduct.id,
                name: updates.name || dbProduct.name,
                changes: updates
              });
            }
          } catch (updateError: any) {
            console.error(`❌ Error updating product ${dbProduct.name}:`, updateError);
          }
        }
      }

      console.log(`✅ [STEP 3] Comparison complete - ${updatedProducts} products updated`);

      // Update ifoodResult with the comparison results
      if (ifoodResult) {
        ifoodResult.updated_products = updatedProducts;
        (ifoodResult as any).changes_detected = changesDetected;
      }

      // STEP 4: Return comprehensive results
      const result = {
        success: true,
        message: 'Smart sync completed successfully',
        merchant_id: merchantId,
        total_products: ifoodResult.total_products,
        new_products: ifoodResult.new_products,
        updated_products: ifoodResult.updated_products,
        changes_detected: changesDetected.length,
        sync_timestamp: new Date().toISOString(),
        details: {
          ifood_api_result: ifoodResult,
          database_products_count: dbProducts?.length || 0,
          changes: changesDetected
        }
      };

      console.log('🎉 [SMART SYNC] Completed successfully!');
      console.log(`📊 [SUMMARY] Total: ${result.total_products}, New: ${result.new_products}, Updated: ${result.updated_products}`);

      res.json(result);
    } catch (error: any) {
      console.error('❌ Error in smart product sync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed smart product sync: ' + error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

export default createMenuRoutes;