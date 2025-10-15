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
      const { image } = req.body;

      // Validate required fields
      if (!image) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: image (base64 string)'
        });
      }

      console.log(`🖼️ Uploading image for product: ${productId} in merchant: ${merchantId}`);

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

      console.log(`✅ Token found, uploading image to iFood...`);

      // STEP 1: Upload image to iFood
      const ifoodUploadUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/image/upload`;

      const ifoodResponse = await fetch(ifoodUploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image })
      });

      if (!ifoodResponse.ok) {
        const errorText = await ifoodResponse.text();
        console.error(`❌ iFood API failed:`, errorText);
        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status} - ${errorText}`
        });
      }

      const uploadData = await ifoodResponse.json();
      console.log(`✅ Image uploaded to iFood:`, uploadData);

      // Extract imagePath from iFood response
      const imagePath = uploadData.path || uploadData.imagePath || uploadData.url;

      if (!imagePath) {
        console.error(`⚠️ iFood response missing image path:`, uploadData);
        return res.status(500).json({
          success: false,
          error: 'iFood returned success but no image path found'
        });
      }

      // STEP 2: Update product in database
      console.log(`💾 Updating product ${productId} with imagePath: ${imagePath}`);

      const { error: updateError } = await supabase
        .from('products')
        .update({
          imagePath: imagePath,
          updated_at: new Date().toISOString()
        })
        .eq('product_id', productId)
        .eq('merchant_id', merchantId);

      if (updateError) {
        console.error(`❌ Database update failed:`, updateError);
        return res.status(500).json({
          success: false,
          error: 'Image uploaded but failed to update database: ' + updateError.message
        });
      }

      console.log(`✅ Product updated successfully with image path`);

      return res.json({
        success: true,
        message: 'Image uploaded and product updated successfully',
        imagePath: imagePath,
        data: uploadData
      });

    } catch (error: any) {
      console.error('❌ Error uploading product image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload image: ' + error.message
      });
    }
  });

  // Update product with image
  router.put('/merchants/:merchantId/products/:productId', async (req, res) => {
    try {
      const { merchantId, productId } = req.params;

      console.log(`🔄 Updating product with image: ${productId} in merchant: ${merchantId}`);

      // Buscar o imagePath salvo no banco de dados
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('imagePath, item_id, product_id, name, description, price, ifood_category_id, is_active')
        .eq('product_id', productId)
        .eq('merchant_id', merchantId)
        .single();

      if (productError || !productData) {
        console.error(`❌ Product not found in database:`, productError);
        return res.status(404).json({
          success: false,
          error: 'Produto não encontrado no banco de dados'
        });
      }

      const imagePath = (productData as any).imagePath || '';
      console.log(`✅ Product found with imagePath: ${imagePath}`);

      // Get access token
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

      // Atualizar produto no iFood com a imagem
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/items`;

      // ✅ Campos essenciais apenas
      // Converter boolean para string do status do iFood
      const ifoodStatus = productData.is_active ? 'AVAILABLE' : 'UNAVAILABLE';

      const updateData = {
        item: {
          id: productData.item_id,              // ✅ Obrigatório - ID do item
          productId: productData.product_id,    // ✅ Obrigatório - UUID do produto
          categoryId: productData.ifood_category_id, // ✅ Obrigatório - CategoryId
          status: ifoodStatus,                  // ✅ Obrigatório - AVAILABLE/UNAVAILABLE
          imagePath: imagePath                  // ✅ Path da imagem
        },
        products: [{
          id: productData.product_id,           // ✅ Obrigatório - UUID do produto
          name: productData.name,               // ✅ Obrigatório - Nome do produto
          imagePath: imagePath                  // ✅ Path da imagem
        }]
      };

      console.log(`📡 Sending PUT request to iFood with imagePath...`);
      console.log(`📦 Payload:`, JSON.stringify(updateData, null, 2));

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (ifoodResponse.ok) {
        console.log(`✅ Product updated successfully on iFood with image`);
        return res.json({
          success: true,
          workflow: 'database-image-path',
          image_path: imagePath,
          message: 'Produto atualizado no iFood com a imagem'
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
      console.error('❌ Error updating product image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update product image: ' + error.message
      });
    }
  });

  // Get product details from iFood and sync image to database
  router.get('/merchants/:merchantId/product/:productId', async (req, res) => {
    try {
      const { merchantId, productId } = req.params;

      console.log(`📋 Getting product from iFood: ${productId} from merchant: ${merchantId}`);

      // Get access token
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

      // Buscar produto no iFood
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/product/${productId}`;

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!ifoodResponse.ok) {
        const errorText = await ifoodResponse.text();
        console.error(`❌ iFood API failed:`, errorText);
        return res.status(ifoodResponse.status).json({
          success: false,
          error: `iFood API error: ${ifoodResponse.status}`
        });
      }

      const ifoodProduct = await ifoodResponse.json();
      console.log(`✅ Product from iFood:`, ifoodProduct);

      // Se o produto tem imagem, atualizar no banco de dados
      if (ifoodProduct.image) {
        console.log(`🖼️ Updating imagePath in database: ${ifoodProduct.image}`);

        const { error: updateError } = await supabase
          .from('products')
          .update({
            imagePath: ifoodProduct.image,
            updated_at: new Date().toISOString()
          })
          .eq('product_id', productId)
          .eq('merchant_id', merchantId);

        if (updateError) {
          console.error(`⚠️ Failed to update imagePath:`, updateError);
        } else {
          console.log(`✅ imagePath updated successfully`);
        }
      }

      // Retornar dados do iFood com imageUrl
      res.json({
        success: true,
        data: {
          ...ifoodProduct,
          imageUrl: ifoodProduct.image
        }
      });

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

  // Upload product image
  router.post('/merchants/:merchantId/image/upload', async (req, res) => {
    try {
      const { merchantId } = req.params;
      const { image } = req.body;

      // Validate required fields
      if (!image) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: image (base64 string)'
        });
      }

      console.log(`🖼️ Image upload for merchant: ${merchantId}`);

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

      console.log(`✅ Token found, uploading image to iFood...`);

      // Call iFood API
      const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/image/upload`;

      const ifoodResponse = await fetch(ifoodUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image })
      });

      if (ifoodResponse.ok) {
        const responseData = await ifoodResponse.json();
        console.log(`✅ Image uploaded successfully`);

        return res.json({
          success: true,
          message: 'Image uploaded successfully',
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
      console.error('❌ Error uploading image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload image: ' + error.message
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

      // Get access token using fixed client_secret
      const TARGET_CLIENT_SECRET = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';

      console.log(`🔑 Buscando token por client_secret: ${TARGET_CLIENT_SECRET.substring(0, 10)}...`);

      console.log(`📊 [DEBUG] Iniciando consulta no Supabase...`);
      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token, user_id')
        .eq('client_secret', TARGET_CLIENT_SECRET)
        .single();

      console.log(`📊 [DEBUG] Consulta Supabase finalizada. Error:`, tokenError, `Data:`, !!tokenData);

      if (tokenError || !tokenData) {
        console.error(`❌ Erro ao buscar token por client_secret:`, tokenError);
        return res.status(401).json({
          success: false,
          error: 'Token de acesso não encontrado para o client_secret configurado'
        });
      }

      console.log(`✅ Token encontrado para user_id: ${tokenData.user_id}`);

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
          console.log(`🔑 [TOKEN PREVIEW] Token: ${tokenData.access_token.substring(0, 20)}...`);

          // Create AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

          try {
            console.log(`⏰ [IFOOD API] Iniciando requisição com timeout de 15s...`);

            const ifoodResponse = await fetch(correctUrl, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(correctBody),
              signal: controller.signal
            });

            clearTimeout(timeoutId);
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
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            console.error(`❌ [IFOOD API ERROR] Fetch failed for item ${itemId}:`, fetchError.message);

            if (fetchError.name === 'AbortError') {
              console.error(`⏰ [TIMEOUT] Requisição para iFood expirou após 15s`);
            }

            results.push({
              itemId,
              success: false,
              error: fetchError.name === 'AbortError' ? 'Timeout na API do iFood (15s)' : `Fetch error: ${fetchError.message}`
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

// Export removed - function already exported in declaration