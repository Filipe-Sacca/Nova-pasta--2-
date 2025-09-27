import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Simple sync route - isolated and working
export function createSimpleSyncRoutes(supabaseUrl: string, supabaseKey: string) {
  console.log('🔧 [SIMPLE-ROUTES] Function called with URLs:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('🔧 [SIMPLE-ROUTES] Supabase client created');

  // TEST endpoint para verificar se está funcionando
  router.get('/test-simple', async (req, res) => {
    console.log('🧪 [TEST] Test endpoint hit - ENTRY POINT!');
    console.log('🧪 [TEST] About to send response...');
    res.json({ success: true, message: 'Test endpoint working!' });
    console.log('🧪 [TEST] Response sent successfully!');
  });

  // SIMPLE smart-sync endpoint - just what we need for polling
  router.post('/merchants/:merchantId/products/simple-sync', async (req, res) => {
    console.log('🎯 [SIMPLE SYNC] Endpoint hit - ENTRY POINT - ISOLATED VERSION');
    console.log('🔧 [SIMPLE SYNC] Starting processing...');
    console.log('🔧 [SIMPLE SYNC] Params:', req.params);
    console.log('🔧 [SIMPLE SYNC] Body:', req.body);
    console.log('🔧 [SIMPLE SYNC] About to enter try block...');

    try {
      const { merchantId } = req.params;
      const { quick_mode } = req.body;

      console.log(`🎯 [SIMPLE] merchant: ${merchantId}, quick_mode: ${quick_mode}`);

      // Quick mode: just return database products
      if (quick_mode !== false) {
        console.log('🚀 [SIMPLE] Quick mode - returning database products');

        const { data: dbProducts, error: dbError } = await supabase
          .from('products')
          .select('*')
          .eq('merchant_id', merchantId);

        if (dbError) {
          throw new Error('Database error: ' + dbError.message);
        }

        console.log(`✅ [SIMPLE] Quick mode: ${dbProducts?.length || 0} products found`);

        return res.json({
          success: true,
          message: 'Simple sync (quick mode)',
          merchant_id: merchantId,
          total_products: dbProducts?.length || 0,
          updated_products: 0,
          mode: 'quick',
          timestamp: new Date().toISOString()
        });
      }

      // Full mode: sync with iFood
      console.log('🔥 [SIMPLE] Full mode - syncing with iFood...');

      // Get any available token
      console.log('🔑 [SIMPLE] Getting any available token...');
      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token, user_id')
        .limit(1)
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error('❌ [SIMPLE] No token found');
        return res.status(400).json({
          success: false,
          error: 'No access token found in database',
          mode: 'error'
        });
      }

      console.log('✅ [SIMPLE] Token found');

      // Get categories with catalog_id
      console.log('📂 [SIMPLE] Getting categories...');
      const { data: categories, error: catError } = await supabase
        .from('ifood_categories')
        .select('category_id, name, catalog_id')
        .eq('merchant_id', merchantId);

      if (catError || !categories || categories.length === 0) {
        console.log('⚠️ [SIMPLE] No categories - returning database products');

        const { data: dbProducts, error: dbError } = await supabase
          .from('products')
          .select('*')
          .eq('merchant_id', merchantId);

        return res.json({
          success: true,
          message: 'No categories found',
          merchant_id: merchantId,
          total_products: dbProducts?.length || 0,
          updated_products: 0,
          mode: 'no_categories',
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ [SIMPLE] Found ${categories.length} categories`);

      // Use catalog_id from categories table (no need to fetch from iFood API)
      const catalogId = categories[0]?.catalog_id;
      if (!catalogId) {
        throw new Error('No catalog_id found in categories');
      }

      console.log(`✅ [SIMPLE] Using catalog_id from database: ${catalogId}`);

      // Fetch products from iFood
      let ifoodProducts: any[] = [];

      for (const category of categories) {
        console.log(`🔍 [SIMPLE] Category: ${category.name}`);

        const itemsUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories/${category.category_id}`;

        try {
          const itemsResponse = await fetch(itemsUrl, {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();

            if (itemsData?.items?.length > 0) {
              console.log(`✅ [SIMPLE] ${category.name}: ${itemsData.items.length} products`);

              for (const item of itemsData.items) {
                ifoodProducts.push({
                  id: item.id,
                  name: item.name,
                  description: item.description || null,
                  status: item.status,
                  price: item.price?.value || 0,
                  imagePath: item.imagePath || null
                });
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ [SIMPLE] Error in category ${category.name}:`, error);
        }
      }

      console.log(`✅ [SIMPLE] Total iFood products: ${ifoodProducts.length}`);

      // Get database products
      const { data: dbProducts, error: dbError } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId);

      if (dbError) {
        throw new Error('Database error: ' + dbError.message);
      }

      console.log(`📊 [SIMPLE] Database products: ${dbProducts?.length || 0}`);

      // Compare and update
      let updatedCount = 0;
      const changes: any[] = [];

      for (const ifoodProduct of ifoodProducts) {
        const dbProduct = dbProducts?.find(p => p.item_id === ifoodProduct.id);

        if (dbProduct) {
          const updates: any = {};
          let needsUpdate = false;

          // Compare status
          const ifoodStatus = ifoodProduct.status === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE';
          if (dbProduct.is_active !== ifoodStatus) {
            updates.is_active = ifoodStatus;
            needsUpdate = true;
            console.log(`📊 [SIMPLE] ${dbProduct.name}: ${dbProduct.is_active} → ${ifoodStatus}`);
          }

          // Compare price
          if (dbProduct.price !== ifoodProduct.price) {
            updates.price = ifoodProduct.price;
            needsUpdate = true;
            console.log(`💰 [SIMPLE] ${dbProduct.name}: R$ ${dbProduct.price} → R$ ${ifoodProduct.price}`);
          }

          // Compare image
          if (dbProduct.imagePath !== ifoodProduct.imagePath) {
            updates.imagePath = ifoodProduct.imagePath;
            needsUpdate = true;
            console.log(`🖼️ [SIMPLE] ${dbProduct.name}: Image updated`);
          }

          // Compare description
          if (dbProduct.description !== ifoodProduct.description) {
            updates.description = ifoodProduct.description;
            needsUpdate = true;
            console.log(`📄 [SIMPLE] ${dbProduct.name}: Description updated`);
          }

          // Update if needed
          if (needsUpdate) {
            const { error: updateError } = await supabase
              .from('products')
              .update({
                ...updates,
                updated_at: new Date().toISOString()
              })
              .eq('id', dbProduct.id);

            if (!updateError) {
              updatedCount++;
              changes.push({
                product: dbProduct.name,
                changes: updates
              });
              console.log(`✅ [SIMPLE] Updated: ${dbProduct.name}`);
            }
          }
        }
      }

      console.log(`🎉 [SIMPLE] Sync complete: ${updatedCount} products updated`);

      return res.json({
        success: true,
        message: 'Simple sync completed',
        merchant_id: merchantId,
        total_products: ifoodProducts.length,
        updated_products: updatedCount,
        changes_detected: changes.length,
        mode: 'full',
        timestamp: new Date().toISOString(),
        changes: changes
      });

    } catch (error: any) {
      console.error('❌ [SIMPLE SYNC] Error:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
        mode: 'error',
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log('🔧 [SIMPLE-ROUTES] Router configured, returning...');
  return router;
}