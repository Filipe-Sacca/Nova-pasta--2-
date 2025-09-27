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
      // const result = await productService.syncProducts(user_id, merchant_id); // syncProducts removed
      const result = { success: false, error: 'syncProducts method removed - use alternative sync' };
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
      // const result = await productService.syncProducts(user_id, merchantId); // syncProducts removed
      const result = { success: false, error: 'syncProducts method removed - use alternative sync' };
      res.json(result);
    } catch (error: any) {
      console.error('❌ Error in manual product sync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed manual product sync: ' + error.message
      });
    }
  });

  // WORKING Smart product sync - direct iFood API calls without IFoodProductService
  router.post('/merchants/:merchantId/products/smart-sync-working', async (req, res) => {
    console.log('🚨 [WORKING SYNC] Endpoint hit - ENTRY POINT');
    try {
      const { merchantId } = req.params;
      const { user_id, quick_mode } = req.body;

      console.log(`🔥 [WORKING] Sync for merchant: ${merchantId}, user: ${user_id}, quick_mode: ${quick_mode}`);

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

      // Get token first
      console.log('🔑 [WORKING] Getting access token...');
      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', user_id)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('No valid token found for user');
      }
      console.log('✅ [WORKING] Token found, proceeding...');

      // Get categories
      console.log('📂 [WORKING] Getting categories...');
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('ifood_categories')
        .select('category_id, name')
        .eq('merchant_id', merchantId);

      if (categoriesError || !categoriesData || categoriesData.length === 0) {
        console.log('⚠️ [WORKING] No categories found, returning database products only');

        const { data: dbProducts, error: dbError } = await supabase
          .from('products')
          .select('*')
          .eq('merchant_id', merchantId);

        return res.json({
          success: true,
          message: 'No categories found - returning existing products',
          merchant_id: merchantId,
          total_products: dbProducts?.length || 0,
          updated_products: 0,
          sync_timestamp: new Date().toISOString(),
          mode: 'no_categories'
        });
      }

      console.log(`✅ [WORKING] Found ${categoriesData.length} categories`);

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

      // Fetch products from iFood API
      let allIfoodProducts: any[] = [];

      for (const category of categoriesData) {
        console.log(`🔍 [WORKING] Fetching products from category: ${category.name}`);

        const itemsUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories/${category.category_id}`;

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
            if (itemsData && itemsData.items && itemsData.items.length > 0) {
              console.log(`✅ [WORKING] Found ${itemsData.items.length} products in ${category.name}`);

              // Process products
              for (const item of itemsData.items) {
                allIfoodProducts.push({
                  id: item.id,
                  name: item.name,
                  description: item.description || null,
                  status: item.status,
                  price: item.price?.value || 0,
                  imagePath: item.imagePath || null,
                  category: category.name,
                  category_id: category.category_id
                });
              }
            }
          } else {
            console.warn(`⚠️ [WORKING] Failed to fetch items from category ${category.name}: ${itemsResponse.status}`);
          }
        } catch (error) {
          console.error(`❌ [WORKING] Error fetching from category ${category.name}:`, error);
        }
      }

      console.log(`✅ [WORKING] Total products fetched from iFood: ${allIfoodProducts.length}`);

      // Get current products from database
      const { data: dbProducts, error: dbError } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId);

      if (dbError) {
        throw new Error('Failed to fetch products from database: ' + dbError.message);
      }

      console.log(`📊 [WORKING] Products in database: ${dbProducts?.length || 0}`);

      // Compare and update
      let updatedProducts = 0;
      const changesDetected: any[] = [];

      for (const ifoodProduct of allIfoodProducts) {
        const dbProduct = dbProducts?.find(p => p.item_id === ifoodProduct.id);

        if (dbProduct) {
          let needsUpdate = false;
          const updates: any = {};

          // Compare status
          const ifoodStatus = ifoodProduct.status === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE';
          if (dbProduct.is_active !== ifoodStatus) {
            console.log(`📊 [WORKING] ${dbProduct.name}: Status ${dbProduct.is_active} → ${ifoodStatus}`);
            updates.is_active = ifoodStatus;
            needsUpdate = true;
          }

          // Compare price
          if (dbProduct.price !== ifoodProduct.price) {
            console.log(`💰 [WORKING] ${dbProduct.name}: Price R$ ${dbProduct.price} → R$ ${ifoodProduct.price}`);
            updates.price = ifoodProduct.price;
            needsUpdate = true;
          }

          // Compare image
          if (dbProduct.imagePath !== ifoodProduct.imagePath) {
            console.log(`🖼️ [WORKING] ${dbProduct.name}: Image updated`);
            updates.imagePath = ifoodProduct.imagePath;
            needsUpdate = true;
          }

          // Compare description
          if (dbProduct.description !== ifoodProduct.description) {
            console.log(`📄 [WORKING] ${dbProduct.name}: Description updated`);
            updates.description = ifoodProduct.description;
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

              if (!updateError) {
                updatedProducts++;
                changesDetected.push({
                  product_id: dbProduct.id,
                  name: dbProduct.name,
                  changes: updates
                });
                console.log(`✅ [WORKING] Updated: ${dbProduct.name}`);
              } else {
                console.error(`❌ [WORKING] Failed to update ${dbProduct.name}:`, updateError);
              }
            } catch (updateError) {
              console.error(`❌ [WORKING] Error updating ${dbProduct.name}:`, updateError);
            }
          }
        }
      }

      console.log(`🎉 [WORKING] Sync completed - ${updatedProducts} products updated`);

      return res.json({
        success: true,
        message: 'Working sync completed successfully',
        merchant_id: merchantId,
        total_products: allIfoodProducts.length,
        updated_products: updatedProducts,
        changes_detected: changesDetected.length,
        sync_timestamp: new Date().toISOString(),
        mode: 'full',
        details: {
          ifood_products: allIfoodProducts.length,
          database_products: dbProducts?.length || 0,
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


  return router;
}

export default createMenuRoutes;