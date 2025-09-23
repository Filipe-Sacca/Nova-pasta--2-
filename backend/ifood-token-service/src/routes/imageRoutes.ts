import express from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { IFoodProductService } from '../ifoodProductService';

const router = express.Router();

// Interface para dependências
interface ImageRouteDependencies {
  supabase: SupabaseClient;
  supabaseUrl: string;
  supabaseKey: string;
}

export function createImageRoutes(deps: ImageRouteDependencies) {
  const { supabase, supabaseUrl, supabaseKey } = deps;

  // ============================================================================
  // 🖼️ PRODUCT IMAGE MANAGEMENT ENDPOINTS
  // ============================================================================

  // Upload product image (two-step workflow)
  router.post('/merchants/:merchantId/products/:productId/upload-image', async (req, res) => {
    try {
      const { merchantId, productId } = req.params;
      const { user_id, imageData, fileName } = req.body;

      console.log(`🖼️ Uploading image for product: ${productId} in merchant: ${merchantId}`);
      const productService = new IFoodProductService(supabaseUrl, supabaseKey);

      // Note: This method needs to be implemented in IFoodProductService
      // const result = await productService.uploadProductImage(user_id, merchantId, productId, imageData, fileName);

      // Temporary implementation
      const result = {
        success: false,
        error: 'uploadProductImage method not implemented in IFoodProductService'
      };

      res.json(result);
    } catch (error: any) {
      console.error('❌ Error uploading product image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload image: ' + error.message
      });
    }
  });

  // Update product image
  router.put('/merchants/:merchantId/products/:productId', async (req, res) => {
    try {
      const { merchantId, productId } = req.params;
      const { user_id } = req.body;

      console.log(`🔄 Updating product image: ${productId} in merchant: ${merchantId}`);
      const productService = new IFoodProductService(supabaseUrl, supabaseKey);

      // Note: This method needs to be implemented in IFoodProductService
      // const result = await productService.updateProductImage(user_id, merchantId, productId);

      // Temporary implementation
      const result = {
        success: false,
        error: 'updateProductImage method not implemented in IFoodProductService'
      };

      res.json(result);
    } catch (error: any) {
      console.error('❌ Error updating product image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update product image: ' + error.message
      });
    }
  });

  // Get product details
  router.get('/merchants/:merchantId/products/:productId', async (req, res) => {
    try {
      const { merchantId, productId } = req.params;
      const { user_id } = req.query;

      console.log(`📋 Getting product: ${productId} from merchant: ${merchantId}`);
      const productService = new IFoodProductService(supabaseUrl, supabaseKey);

      // Note: This method needs to be implemented in IFoodProductService
      // const result = await productService.getProduct(user_id, merchantId, productId);

      // Temporary implementation
      const result = {
        success: false,
        error: 'getProduct method not implemented in IFoodProductService'
      };

      res.json(result);
    } catch (error: any) {
      console.error('❌ Error getting product:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get product: ' + error.message
      });
    }
  });

  // Get product images
  router.get('/merchants/:merchantId/product-images', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { user_id } = req.query;

      console.log(`🖼️ [GET IMAGES] Buscando imagens para merchant: ${merchantId}, user: ${user_id}`);

      // Buscar produtos com imagens do banco de dados
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, imagePath, item_id, product_id, merchant_id, category, price, is_active')
        .eq('merchant_id', merchantId)
        .eq('user_id', user_id)
        .not('imagePath', 'is', null)
        .order('name');

      if (error) {
        console.error('❌ Erro ao buscar imagens do banco:', error);
        throw error;
      }

      console.log(`🖼️ Encontrados ${products?.length || 0} produtos com imagens`);

      // Formatar dados para resposta
      const productImages = (products || []).map(product => ({
        id: product.id,
        name: product.name,
        imagePath: product.imagePath,
        itemId: product.item_id,
        productId: product.product_id,
        merchantId: product.merchant_id,
        category: product.category,
        price: product.price,
        isActive: product.is_active
      }));

      res.json({
        success: true,
        data: productImages,
        total: productImages.length,
        message: `${productImages.length} produtos com imagens encontrados`
      });

    } catch (error: any) {
      console.error('❌ Erro ao buscar product images:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get product images: ' + error.message
      });
    }
  });

  // Legacy single upload endpoint
  router.post('/merchants/:merchantId/image/upload', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { user_id, productId, imageData, fileName } = req.body;

      console.log(`🖼️ Legacy image upload for merchant: ${merchantId}, product: ${productId}`);
      const productService = new IFoodProductService(supabaseUrl, supabaseKey);

      // Note: This method needs to be implemented in IFoodProductService
      // const result = await productService.uploadProductImage(user_id, merchantId, productId, imageData, fileName);

      // Temporary implementation
      const result = {
        success: false,
        error: 'uploadProductImage method not implemented in IFoodProductService'
      };

      res.json(result);
    } catch (error: any) {
      console.error('❌ Error in legacy image upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed legacy image upload: ' + error.message
      });
    }
  });

  // Update item/product status endpoint
  router.patch('/merchants/:merchantId/items/status', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { user_id, items, itemId, status } = req.body;

      console.log(`🔄 Updating item status for merchant: ${merchantId}`);
      console.log(`📦 [REQUEST DETAILS] Full request body:`, JSON.stringify(req.body, null, 2));

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'user_id é obrigatório'
        });
      }

      // Support both formats: single item or array of items
      let itemsToUpdate: Array<{itemId: string, status: string}> = [];

      if (items && Array.isArray(items)) {
        itemsToUpdate = items;
      } else if (itemId && status) {
        itemsToUpdate = [{ itemId, status }];
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either "items" array or "itemId" and "status" are required'
        });
      }

      console.log(`📦 Items to update:`, itemsToUpdate);

      // Get access token
      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', user_id)
        .single();

      if (tokenError || !tokenData) {
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado'
        });
      }

      let successCount = 0;
      let errorCount = 0;
      const results: any[] = [];

      // Update each item status
      for (const item of itemsToUpdate) {
        try {
          const { itemId, status } = item;

          if (!itemId || !status) {
            results.push({
              itemId: itemId || 'unknown',
              success: false,
              error: 'itemId and status are required'
            });
            errorCount++;
            continue;
          }

          console.log(`🔄 Updating item ${itemId} to status: ${status}`);

          // Call iFood API to update item status
          const correctUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/items/status`;
          const correctBody = { itemId, status };

          console.log(`📡 [CORRECTED REQUEST] URL: ${correctUrl}`);
          console.log(`📡 [CORRECTED REQUEST] Body:`, correctBody);

          const ifoodResponse = await fetch(correctUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(correctBody)
          });

          console.log(`📡 [IFOOD API RESPONSE] Status: ${ifoodResponse.status}`);

          if (ifoodResponse.ok) {
            console.log(`✅ Item ${itemId} status updated successfully`);

            // Update local database
            try {
              const { error: dbError } = await supabase
                .from('products')
                .update({
                  is_active: status,
                  updated_at: new Date().toISOString()
                })
                .eq('item_id', itemId)
                .eq('merchant_id', merchantId);

              if (dbError) {
                console.error(`⚠️ Failed to update local database for item ${itemId}:`, dbError);
              } else {
                console.log(`✅ Local database updated for item ${itemId}`);
              }
            } catch (dbUpdateError) {
              console.error(`❌ Error updating local database for item ${itemId}:`, dbUpdateError);
            }

            results.push({
              itemId,
              success: true,
              status: status
            });
            successCount++;
          } else {
            const errorText = await ifoodResponse.text();
            console.error(`❌ Failed to update item ${itemId}:`, errorText);
            results.push({
              itemId,
              success: false,
              error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
            });
            errorCount++;
          }
        } catch (itemError: any) {
          console.error(`❌ Error updating item ${item.itemId}:`, itemError);
          results.push({
            itemId: item.itemId || 'unknown',
            success: false,
            error: itemError.message
          });
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `Updated ${successCount} items successfully, ${errorCount} failed`,
        results: results,
        summary: {
          total: itemsToUpdate.length,
          success: successCount,
          errors: errorCount
        }
      });
    } catch (error: any) {
      console.error('❌ Error updating item status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update item status: ' + error.message
      });
    }
  });

  return router;
}

export default createImageRoutes;