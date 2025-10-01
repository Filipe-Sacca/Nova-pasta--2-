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
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

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
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

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

      const requestBody = {
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

  // Get categories for catalog
  router.get('/merchants/:merchantId/catalogs/:catalogId/categories', async (req, res) => {
    try {
      const { merchantId, catalogId } = req.params;

      console.log(`📂 Getting categories for merchant: ${merchantId}, catalog: ${catalogId}`);

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

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

      // Get token using client_secret
      console.log('🔑 [WORKING] Getting access token...');
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('No valid token found');
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
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

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
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

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
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

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

      console.log(`💰 Updating option price for merchant: ${merchantId}, option: ${optionId}`);

      // Validate required fields
      if (!optionId || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'optionId and price are required'
        });
      }

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

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
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/options/price`;
      const ifoodPayload = { optionId, price };

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ifoodPayload)
      });

      if (ifoodResponse.ok) {
        console.log(`✅ Option price updated successfully`);

        return res.json({
          success: true,
          message: 'Option price updated successfully',
          optionId,
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
      console.error('❌ Error updating option price:', error);
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

      console.log(`🔄 Updating option status for merchant: ${merchantId}, option: ${optionId}`);

      // Validate required fields
      if (!optionId || !status) {
        return res.status(400).json({
          success: false,
          error: 'optionId and status are required'
        });
      }

      // Get access token using client_secret
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

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
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/options/status`;
      const ifoodPayload = { optionId, status };

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ifoodPayload)
      });

      if (ifoodResponse.ok) {
        console.log(`✅ Option status updated successfully`);

        return res.json({
          success: true,
          message: 'Option status updated successfully',
          optionId,
          status
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
      console.error('❌ Error updating option status:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error: ' + error.message
      });
    }
  });

  return router;
}

export default createMenuRoutes;