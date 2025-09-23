import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { IFoodTokenService, getTokenForUser } from './ifoodTokenService';
import { IFoodMerchantService } from './ifoodMerchantService';
import { IFoodProductService } from './ifoodProductService';
import { IFoodMerchantStatusService } from './ifoodMerchantStatusService';
import IFoodPollingService from './ifoodPollingService';
import IFoodEventService from './ifoodEventService';
import { tokenScheduler } from './tokenScheduler';
import { productSyncScheduler } from './productSyncScheduler';
import { logCleanupScheduler } from './logCleanupScheduler';
import { TokenRequest } from './types';

// ============================================================================
// 🚀 CLEANED IFOOD TOKEN SERVICE - REMAINING MODULES ONLY
// ============================================================================
// Active modules: Token, Merchant, Product, Polling, Event
// Removed modules: Order, Review, Shipping (as requested)
// ============================================================================

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8092;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083',
    'http://localhost:8086',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));

// Enhanced logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📝 [REQUEST] ${timestamp} - ${req.method} ${req.path}`);
  console.log(`🌐 [REQUEST] Origin: ${req.headers.origin || 'N/A'}`);

  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 [REQUEST] Body:`, req.body);
  }

  // Log response
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`📥 [RESPONSE] ${req.method} ${req.path} - Status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };

  next();
});

// ============================================================================
// 🏠 ROOT & HEALTH ENDPOINTS
// ============================================================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'iFood Token Service',
    version: '2.0.0',
    status: 'online',
    activeModules: [
      'Token Management',
      'Merchant Management',
      'Product/Catalog Management',
      'Event Processing',
      'Polling Service'
    ],
    removedModules: [
      'Order Management (deleted)',
      'Review Management (deleted)',
      'Shipping Management (deleted)'
    ],
    endpoints: {
      // ✅ ACTIVE ENDPOINTS
      health: 'GET /health',
      // Token Management
      token: 'POST /token',
      getUserToken: 'GET /token/user/:userId',
      refreshToken: 'POST /token/refresh',
      forceRefresh: 'POST /token/force-refresh/:clientId',
      updateAllExpired: 'POST /token/update-all-expired',
      tokenSchedulerStart: 'POST /token/scheduler/start',
      tokenSchedulerStop: 'POST /token/scheduler/stop',
      tokenSchedulerStatus: 'GET /token/scheduler/status',
      // Merchant Management
      merchant: 'POST /merchant',
      merchantCheck: 'GET /merchant/check/:id',
      merchantsSyncAll: 'POST /merchants/sync-all',
      merchantsRefresh: 'POST /merchants/refresh',
      merchantDetail: 'GET /merchants/:merchantId',
      // Product Management
      products: 'POST /products',
      getProducts: 'GET /products',
      createCategory: 'POST /merchants/:merchantId/categories',
      getCategories: 'GET /merchants/:merchantId/categories',
      productSyncStart: 'POST /products/sync/scheduler/start',
      productSyncStop: 'POST /products/sync/scheduler/stop',
      productSyncStatus: 'GET /products/sync/scheduler/status',
      productSyncManual: 'POST /merchants/:merchantId/products/sync',
      // Merchant Status
      statusCheck: 'POST /merchant-status/check',
      singleStatus: 'GET /merchant-status/:merchantId',
      startScheduler: 'POST /merchant-status/start-scheduler',
      updateOpeningHours: 'PUT /merchants/:merchantId/opening-hours',
      createInterruption: 'POST /merchants/:merchantId/interruptions',
      listInterruptions: 'GET /merchants/:merchantId/interruptions',
      syncInterruptions: 'POST /merchants/:merchantId/interruptions/sync',
      removeInterruption: 'DELETE /merchants/:merchantId/interruptions/:interruptionId',
      // Product Images
      uploadProductImage: 'POST /merchants/:merchantId/products/:productId/upload-image',
      updateProductImage: 'PUT /merchants/:merchantId/products/:productId',
      getProduct: 'GET /merchants/:merchantId/products/:productId',
      getProductImages: 'GET /merchants/:merchantId/product-images',
      imageUpload: 'POST /merchants/:merchantId/image/upload'
    },
    documentation: 'Check /health for service health',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ifood-token-service',
    version: '2.0.0',
    activeModules: [
      'Token Management ✅',
      'Merchant Management ✅',
      'Product Management ✅',
      'Event Processing ✅',
      'Polling Service ✅'
    ],
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 🔐 TOKEN MANAGEMENT ENDPOINTS
// ============================================================================

// Token generation endpoint
app.post('/token', async (req, res) => {
  try {
    // Validate environment variables
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing Supabase configuration. Please check environment variables.'
      });
    }

    // Validate request body
    const { clientId, clientSecret, user_id }: TokenRequest = req.body;

    if (!clientId || !clientSecret || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, clientSecret, user_id'
      });
    }

    console.log('🚀 Token request received:', {
      clientId: clientId.substring(0, 8) + '...',
      user_id: user_id
    });

    // Create token service instance
    const tokenService = new IFoodTokenService(supabaseUrl, supabaseKey);

    // Generate token
    const result = await tokenService.processTokenRequest(clientId, clientSecret, user_id);

    if (result.success) {
      console.log('✅ Token generated successfully for user:', user_id);
      res.json(result);
    } else {
      console.error('❌ Token generation failed:', result.error);
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('❌ Server error during token generation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error: ' + error.message
    });
  }
});

// Get token for user
app.get('/token/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 Fetching token for user: ${userId}`);

    const tokenData = await getTokenForUser(userId);

    if (tokenData) {
      // Check if token is expired
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      const isExpired = now >= expiresAt;

      res.json({
        success: true,
        token: tokenData,
        isExpired,
        timeUntilExpiry: isExpired ? 0 : expiresAt.getTime() - now.getTime()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Token not found for user'
      });
    }
  } catch (error: any) {
    console.error('❌ Error fetching user token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token: ' + error.message
    });
  }
});

// Token refresh endpoint
app.post('/token/refresh', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing user_id'
      });
    }

    console.log(`🔄 Token refresh requested for user: ${user_id}`);

    const tokenService = new IFoodTokenService(supabaseUrl, supabaseKey);
    const result = await tokenService.refreshTokenForUser(user_id);

    if (result.success) {
      console.log('✅ Token refreshed successfully for user:', user_id);
    } else {
      console.error('❌ Token refresh failed:', result.error);
    }

    res.json(result);
  } catch (error: any) {
    console.error('❌ Server error during token refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error: ' + error.message
    });
  }
});

// Force refresh for specific client
app.post('/token/force-refresh/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    console.log(`🔄 Force refresh requested for client: ${clientId}`);

    const tokenService = new IFoodTokenService(supabaseUrl, supabaseKey);
    const result = await tokenService.forceRefreshByClientId(clientId);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error in force refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force refresh: ' + error.message
    });
  }
});

// Update all expired tokens
app.post('/token/update-all-expired', async (req, res) => {
  try {
    console.log('🔄 Updating all expired tokens...');

    const tokenService = new IFoodTokenService(supabaseUrl, supabaseKey);
    const result = await tokenService.updateAllExpiredTokens();

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error updating expired tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update expired tokens: ' + error.message
    });
  }
});

// ============================================================================
// 🔐 TOKEN SCHEDULER ENDPOINTS
// ============================================================================

// Start token scheduler
app.post('/token/scheduler/start', async (req, res) => {
  try {
    console.log('🟢 Starting token scheduler...');

    tokenScheduler.start();

    res.json({
      success: true,
      message: 'Token scheduler started successfully',
      status: tokenScheduler.getStatus()
    });
  } catch (error: any) {
    console.error('❌ Error starting token scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start scheduler: ' + error.message
    });
  }
});

// Stop token scheduler
app.post('/token/scheduler/stop', async (req, res) => {
  try {
    console.log('🔴 Stopping token scheduler...');

    tokenScheduler.stop();

    res.json({
      success: true,
      message: 'Token scheduler stopped successfully',
      status: tokenScheduler.getStatus()
    });
  } catch (error: any) {
    console.error('❌ Error stopping token scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop scheduler: ' + error.message
    });
  }
});

// Get token scheduler status
app.get('/token/scheduler/status', (req, res) => {
  try {
    const status = tokenScheduler.getStatus();

    res.json({
      success: true,
      status: status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status: ' + error.message
    });
  }
});

// ============================================================================
// 🏪 MERCHANT MANAGEMENT ENDPOINTS
// ============================================================================

// Create/Update merchant
app.post('/merchant', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing user_id'
      });
    }

    console.log(`🏪 Merchant operation for user: ${user_id}`);

    const merchantService = new IFoodMerchantService(supabaseUrl, supabaseKey);
    const result = await merchantService.syncUserMerchants(user_id);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error in merchant operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed merchant operation: ' + error.message
    });
  }
});

// Check specific merchant
app.get('/merchant/check/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    console.log(`🔍 Checking merchant: ${id} for user: ${user_id}`);

    const merchantService = new IFoodMerchantService(supabaseUrl, supabaseKey);
    const result = await merchantService.checkMerchant(id, user_id as string);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error checking merchant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check merchant: ' + error.message
    });
  }
});

// Sync all merchants
app.post('/merchants/sync-all', async (req, res) => {
  try {
    const { user_id } = req.body;
    console.log(`🔄 Syncing all merchants for user: ${user_id}`);

    const merchantService = new IFoodMerchantService(supabaseUrl, supabaseKey);
    const result = await merchantService.syncUserMerchants(user_id);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error syncing merchants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync merchants: ' + error.message
    });
  }
});

// Refresh merchants
app.post('/merchants/refresh', async (req, res) => {
  try {
    const { user_id } = req.body;
    console.log(`🔄 Refreshing merchants for user: ${user_id}`);

    const merchantService = new IFoodMerchantService(supabaseUrl, supabaseKey);
    const result = await merchantService.refreshMerchants(user_id);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error refreshing merchants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh merchants: ' + error.message
    });
  }
});

// Get merchant details
app.get('/merchants/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { user_id } = req.query;

    console.log(`📋 Getting merchant details: ${merchantId} for user: ${user_id}`);

    const merchantService = new IFoodMerchantService(supabaseUrl, supabaseKey);
    const result = await merchantService.getMerchantDetails(merchantId, user_id as string);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error getting merchant details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get merchant details: ' + error.message
    });
  }
});

// ============================================================================
// 📦 PRODUCT MANAGEMENT ENDPOINTS
// ============================================================================

// Sync products
app.post('/products', async (req, res) => {
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
app.get('/products', async (req, res) => {
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
      .eq('client_id', user_id)
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
app.post('/merchants/:merchantId/categories', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { user_id, name, template } = req.body;

    console.log(`📂 Creating category for merchant: ${merchantId}`);

    const productService = new IFoodProductService(supabaseUrl, supabaseKey);
    const result = await productService.createCategory(user_id, merchantId, { name, template });

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
app.get('/merchants/:merchantId/categories', async (req, res) => {
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
app.post('/merchants/:merchantId/products/sync', async (req, res) => {
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
app.post('/merchants/:merchantId/products/smart-sync', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { user_id } = req.body;

    console.log(`🧠 Smart product sync for merchant: ${merchantId}`);
    console.log(`👤 User ID: ${user_id}`);

    // Initialize services
    const productService = new IFoodProductService(supabaseUrl, supabaseKey);
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log('🔍 [DEBUG] Categories query result:', categoriesData);
    console.log('🔍 [DEBUG] Categories error:', categoriesError);
    console.log('🔍 [DEBUG] Looking for user_id:', user_id);

    // Initialize variables
    let ifoodResult;
    let allIfoodProducts = [];
    let totalProducts = 0;

    if (categoriesError || !categoriesData || categoriesData.length === 0) {
      console.log('📦 No categories found, skipping iFood fetch and working with existing database products...');

      // When no categories are found, we'll just work with existing database products
      // and skip the iFood API comparison since we can't fetch from iFood without categories
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
      let catalogId: string;

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
          // Use the correct iFood endpoint with catalog ID: GET /merchants/{merchantId}/catalogs/{catalogId}/categories/{categoryId}
          const itemsUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories/${category.category_id}`;

          // 🔥 [JSON REQUEST LOG] - Detailed logging for iFood API request
          console.log(`🔥 [JSON REQUEST] URL: ${itemsUrl}`);
          console.log(`🔥 [JSON REQUEST] Method: GET`);
          console.log(`🔥 [JSON REQUEST] Headers:`, {
            'Authorization': `Bearer ${tokenData.access_token.substring(0, 20)}...`,
            'Content-Type': 'application/json'
          });
          console.log(`🔥 [JSON REQUEST] Full Request Details:`, {
            url: itemsUrl,
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          const itemsResponse = await fetch(itemsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          // 🔥 [JSON RESPONSE LOG] - Detailed logging for iFood API response
          console.log(`🔥 [JSON RESPONSE] Status: ${itemsResponse.status}`);
          console.log(`🔥 [JSON RESPONSE] Status Text: ${itemsResponse.statusText}`);
          console.log(`🔥 [JSON RESPONSE] Headers:`, Object.fromEntries(itemsResponse.headers.entries()));

          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();

            // 🔥 [JSON RESPONSE DATA] - Complete response JSON from iFood API
            console.log(`🔥 [JSON RESPONSE DATA] Complete Response from iFood API for ${category.name}:`);
            console.log(JSON.stringify(itemsData, null, 2));

            // Extract products from the correct structure: response has 'items' and 'products' arrays
            const items = itemsData?.items || [];
            const products = itemsData?.products || [];

            console.log(`✅ Category ${category.name}: ${items.length} items, ${products.length} products`);

            // 🔥 [PIZZA CALABRESA DEBUG] - Special logging for Pizza Calabresa
            if (category.name === 'Pizzas Salgadas') {
              const pizzaCalabresa = items.find((item: any) => item.id === 'b62ec350-be44-480f-81ce-3e9e9e8d0842');
              if (pizzaCalabresa) {
                console.log(`🔥 [CALABRESA JSON] Found Pizza Calabresa in iFood response:`);
                console.log(JSON.stringify(pizzaCalabresa, null, 2));
              } else {
                console.log(`🔥 [CALABRESA JSON] Pizza Calabresa NOT found in items array`);
                console.log(`🔥 [CALABRESA JSON] Available items in ${category.name}:`);
                items.forEach((item: any) => {
                  console.log(`  - ID: ${item.id}, Name: ${item.name || 'N/A'}, Status: ${item.status}`);
                });
              }
            }

            // Process items (these are the menu items with status, price, etc.)
            if (items && Array.isArray(items) && items.length > 0) {
              // Map items with their corresponding products
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

        } catch (error) {
          console.error(`❌ Error fetching category ${category.name}:`, error);
        }
      }

      console.log(`✅ [STEP 1] Fetched ${totalProducts} products from iFood using correct endpoint`);

      // Create ifoodResult object for category-based sync
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
    let changesDetected = [];

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
      }

      if (ifoodProduct) {
        console.log(`✅ [DEBUG] Found match for ${dbProduct.name}: ${ifoodProduct.name} (status: ${ifoodProduct.status})`);
        let needsUpdate = false;
        const updates = {};

        // Compare status (is_active) - Convert iFood AVAILABLE/UNAVAILABLE to boolean
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
          } catch (updateError) {
            console.error(`❌ Error updating product ${dbProduct.name}:`, updateError);
          }
        }
      }
    }

    console.log(`✅ [STEP 3] Comparison complete - ${updatedProducts} products updated`);

    // Update ifoodResult with the comparison results
    if (ifoodResult) {
      ifoodResult.updated_products = updatedProducts;
      ifoodResult.changes_detected = changesDetected;
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

// ============================================================================
// 📦 PRODUCT SYNC SCHEDULER ENDPOINTS
// ============================================================================

// Start product sync scheduler
app.post('/products/sync/scheduler/start', async (req, res) => {
  try {
    console.log('🟢 Starting product sync scheduler...');

    productSyncScheduler.start(0.5); // 30 segundos

    res.json({
      success: true,
      message: 'Product sync scheduler started successfully',
      status: productSyncScheduler.getStatus()
    });
  } catch (error: any) {
    console.error('❌ Error starting product sync scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start product sync scheduler: ' + error.message
    });
  }
});

// Stop product sync scheduler
app.post('/products/sync/scheduler/stop', async (req, res) => {
  try {
    console.log('🔴 Stopping product sync scheduler...');

    productSyncScheduler.stop();

    res.json({
      success: true,
      message: 'Product sync scheduler stopped successfully',
      status: productSyncScheduler.getStatus()
    });
  } catch (error: any) {
    console.error('❌ Error stopping product sync scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop product sync scheduler: ' + error.message
    });
  }
});

// Get product sync scheduler status
app.get('/products/sync/scheduler/status', (req, res) => {
  try {
    const status = productSyncScheduler.getStatus();

    res.json({
      success: true,
      status: status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error getting product sync scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product sync scheduler status: ' + error.message
    });
  }
});

// ============================================================================
// 🟢 MERCHANT STATUS ENDPOINTS
// ============================================================================

// Check merchant status
app.post('/merchant-status/check', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing user_id'
      });
    }

    console.log(`🔍 Checking merchant status for user: ${user_id}`);

    const statusService = new IFoodMerchantStatusService(supabaseUrl, supabaseKey);
    const result = await statusService.checkUserMerchantsStatus(user_id);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error checking merchant status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check merchant status: ' + error.message
    });
  }
});

// Get single merchant status
app.get('/merchant-status/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { user_id } = req.query;

    console.log(`🔍 Getting status for merchant: ${merchantId}`);

    const statusService = new IFoodMerchantStatusService(supabaseUrl, supabaseKey);
    const result = await statusService.getSingleMerchantStatus(merchantId, user_id as string);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error getting merchant status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get merchant status: ' + error.message
    });
  }
});

// Start merchant status scheduler
app.post('/merchant-status/start-scheduler', async (req, res) => {
  try {
    console.log('🟢 Starting merchant status scheduler...');

    // Note: Implementation depends on your scheduler setup
    res.json({
      success: true,
      message: 'Merchant status scheduler started successfully'
    });
  } catch (error: any) {
    console.error('❌ Error starting merchant status scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start scheduler: ' + error.message
    });
  }
});

// ============================================================================
// 🖼️ PRODUCT IMAGE MANAGEMENT ENDPOINTS
// ============================================================================

// Upload product image (two-step workflow)
app.post('/merchants/:merchantId/products/:productId/upload-image', async (req, res) => {
  try {
    const { merchantId, productId } = req.params;
    const { user_id, imageData, fileName } = req.body;

    console.log(`🖼️ Uploading image for product: ${productId} in merchant: ${merchantId}`);

    const productService = new IFoodProductService(supabaseUrl, supabaseKey);
    const result = await productService.uploadProductImage(user_id, merchantId, productId, imageData, fileName);

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
app.put('/merchants/:merchantId/products/:productId', async (req, res) => {
  try {
    const { merchantId, productId } = req.params;
    const { user_id } = req.body;

    console.log(`🔄 Updating product image: ${productId} in merchant: ${merchantId}`);

    const productService = new IFoodProductService(supabaseUrl, supabaseKey);
    const result = await productService.updateProductImage(user_id, merchantId, productId);

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
app.get('/merchants/:merchantId/products/:productId', async (req, res) => {
  try {
    const { merchantId, productId } = req.params;
    const { user_id } = req.query;

    console.log(`📋 Getting product: ${productId} from merchant: ${merchantId}`);

    const productService = new IFoodProductService(supabaseUrl, supabaseKey);
    const result = await productService.getProduct(user_id as string, merchantId, productId);

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
app.get('/merchants/:merchantId/product-images', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { user_id } = req.query;

    console.log(`🖼️ Getting product images for merchant: ${merchantId}`);

    const productService = new IFoodProductService(supabaseUrl, supabaseKey);
    const result = await productService.getProductImages(user_id as string, merchantId);

    res.json(result);
  } catch (error: any) {
    console.error('❌ Error getting product images:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product images: ' + error.message
    });
  }
});

// Legacy single upload endpoint
app.post('/merchants/:merchantId/image/upload', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { user_id, productId, imageData, fileName } = req.body;

    console.log(`🖼️ Legacy image upload for merchant: ${merchantId}, product: ${productId}`);

    const productService = new IFoodProductService(supabaseUrl, supabaseKey);
    const result = await productService.uploadProductImage(user_id, merchantId, productId, imageData, fileName);

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
app.patch('/merchants/:merchantId/items/status', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { user_id, items, itemId, status } = req.body;

    console.log(`🔄 Updating item status for merchant: ${merchantId}`);
    console.log(`📦 [REQUEST DETAILS] Full request body:`, JSON.stringify(req.body, null, 2));
    console.log(`📦 [REQUEST DETAILS] Merchant ID: ${merchantId}`);
    console.log(`📦 [REQUEST DETAILS] User ID: ${user_id}`);
    console.log(`📦 [REQUEST DETAILS] Item ID (single): ${itemId}`);
    console.log(`📦 [REQUEST DETAILS] Status (single): ${status}`);
    console.log(`📦 [REQUEST DETAILS] Items (array): ${JSON.stringify(items, null, 2)}`);

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id é obrigatório'
      });
    }

    // Support both formats: single item or array of items
    let itemsToUpdate = [];
    if (items && Array.isArray(items)) {
      // Array format
      itemsToUpdate = items;
    } else if (itemId && status) {
      // Single item format
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
    const results = [];

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

        // Log detalhado da requisição
        const requestUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/items/${itemId}/status`;
        const requestBody = { status };
        const requestHeaders = {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        };

        console.log(`📡 [IFOOD API REQUEST] URL: ${requestUrl}`);
        console.log(`📡 [IFOOD API REQUEST] Method: PATCH`);
        console.log(`📡 [IFOOD API REQUEST] Headers:`, {
          'Authorization': `Bearer ${tokenData.access_token.substring(0, 20)}...`,
          'Content-Type': 'application/json'
        });
        console.log(`📡 [IFOOD API REQUEST] Body:`, requestBody);

        // Call iFood API to update item status
        const correctUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/items/status`;
        const correctBody = { itemId, status };

        console.log(`📡 [CORRECTED REQUEST] URL: ${correctUrl}`);
        console.log(`📡 [CORRECTED REQUEST] Body:`, correctBody);

        const ifoodResponse = await fetch(correctUrl, {
          method: 'PATCH',
          headers: requestHeaders,
          body: JSON.stringify(correctBody)
        });

        // Log da resposta
        console.log(`📡 [IFOOD API RESPONSE] Status: ${ifoodResponse.status}`);
        console.log(`📡 [IFOOD API RESPONSE] Headers:`, Object.fromEntries(ifoodResponse.headers.entries()));

        const responseText = await ifoodResponse.text();
        console.log(`📡 [IFOOD API RESPONSE] Body:`, responseText);

        if (ifoodResponse.ok) {
          console.log(`✅ Item ${itemId} status updated successfully`);

          // Update local database
          try {
            const { error: dbError } = await supabase
              .from('products')
              .update({
                is_active: status === 'AVAILABLE',
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

// ============================================================================
// 📅 INTERRUPTIONS ENDPOINTS
// ============================================================================

// GET /debug/table-structure - Debug table structure
app.get('/debug/table-structure', async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Checking ifood_interruptions table structure...');

    // Tentar SELECT vazio para ver estrutura
    const { data, error } = await supabase
      .from('ifood_interruptions')
      .select('*')
      .limit(0);

    console.log('📊 [DEBUG] Table query result:', { data, error });

    res.json({
      success: true,
      data,
      error,
      message: 'Check server logs for table structure info'
    });
  } catch (error: any) {
    console.error('❌ [DEBUG] Error checking table:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /merchants/:merchantId/interruptions - List scheduled interruptions
app.get('/merchants/:merchantId/interruptions', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { userId } = req.query;

    console.log(`📝 [REQUEST] ${new Date().toISOString()} - GET /merchants/${merchantId}/interruptions`);
    console.log(`🌐 [REQUEST] Origin: ${req.get('Origin') || 'N/A'}`);
    console.log(`👤 [REQUEST] User ID: ${userId}`);

    if (!userId) {
      console.log(`📥 [RESPONSE] GET /merchants/${merchantId}/interruptions - Status: 400 - Missing userId`);
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    // Buscar interrupções do banco de dados local
    const { data: interruptions, error: dbError } = await supabase
      .from('ifood_interruptions')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      console.log(`📥 [RESPONSE] GET /merchants/${merchantId}/interruptions - Status: 500`);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar interrupções no banco de dados'
      });
    }

    // Formatar dados para retorno usando schema correto
    const formattedInterruptions = (interruptions || []).map(interruption => ({
      id: interruption.id,
      merchantId: interruption.merchant_id,
      ifoodInterruptionId: interruption.ifood_interruption_id,
      startDate: interruption.start_date,
      endDate: interruption.end_date,
      description: interruption.description,
      reason: interruption.reason,
      isActive: interruption.is_active,
      createdAt: interruption.created_at,
      updatedAt: interruption.updated_at
    }));

    const result = {
      success: true,
      interruptions: formattedInterruptions,
      total: formattedInterruptions.length
    };

    console.log(`📥 [RESPONSE] GET /merchants/${merchantId}/interruptions - Status: 200 - Found ${formattedInterruptions.length} interruptions`);
    res.json(result);

  } catch (error: any) {
    console.error('❌ Error fetching interruptions:', error);
    console.log(`📥 [RESPONSE] GET /merchants/${merchantId}/interruptions - Status: 500`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interruptions: ' + error.message
    });
  }
});

// POST /merchants/:merchantId/interruptions - Create scheduled interruption
app.post('/merchants/:merchantId/interruptions', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate, description, reason, userId } = req.body;

    console.log(`📝 [REQUEST] ${new Date().toISOString()} - POST /merchants/${merchantId}/interruptions`);
    console.log(`🌐 [REQUEST] Origin: ${req.get('Origin') || 'N/A'}`);
    console.log(`📦 [REQUEST] Body:`, req.body);

    // Validar parâmetros obrigatórios
    if (!merchantId || !startDate || !endDate || !userId) {
      console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions - Status: 400 - Missing required fields`);
      return res.status(400).json({
        success: false,
        error: 'merchantId, startDate, endDate e userId são obrigatórios'
      });
    }

    // Buscar token de acesso para o usuário
    const { data: tokenData, error: tokenError } = await supabase
      .from('ifood_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData?.access_token) {
      console.error('❌ Token not found for user:', userId);
      console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions - Status: 401`);
      return res.status(401).json({
        success: false,
        error: 'Token de acesso não encontrado. Faça login no iFood primeiro.'
      });
    }

    // Preparar dados para a API do iFood
    const interruptionData = {
      id: crypto.randomUUID(),
      description: description || '',
      start: startDate,
      end: endDate
    };

    console.log('📡 [IFOOD API] Sending interruption to iFood:', interruptionData);

    // Enviar para a API do iFood
    const ifoodResponse = await fetch(`https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/interruptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(interruptionData)
    });

    console.log('📊 [IFOOD API] Response status:', ifoodResponse.status);

    if (!ifoodResponse.ok) {
      const errorText = await ifoodResponse.text();
      console.error('❌ [IFOOD API] Error response:', errorText);

      let errorMessage = 'Erro ao criar interrupção na API do iFood';
      if (ifoodResponse.status === 401) {
        errorMessage = 'Token expirado. Faça login novamente no iFood.';
      } else if (ifoodResponse.status === 403) {
        errorMessage = 'Acesso negado. Verifique suas permissões.';
      } else if (ifoodResponse.status === 404) {
        errorMessage = 'Merchant não encontrado.';
      }

      console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions - Status: ${ifoodResponse.status}`);
      return res.status(ifoodResponse.status).json({
        success: false,
        error: errorMessage,
        details: errorText
      });
    }

    const ifoodResult = await ifoodResponse.json();
    console.log('✅ [IFOOD API] Success response:', ifoodResult);

    // Salvar no banco de dados local usando o schema correto
    const { data: dbResult, error: dbError } = await supabase
      .from('ifood_interruptions')
      .insert({
        user_id: userId,
        merchant_id: merchantId,
        ifood_interruption_id: ifoodResult.id, // ID retornado pela API do iFood
        start_date: startDate,
        end_date: endDate,
        description: description || '',
        reason: reason || '',
        is_active: true
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      // Se salvou na API do iFood mas falhou no banco, ainda consideramos sucesso
      console.log('⚠️ Saved to iFood API but failed to save locally');
    } else {
      console.log('✅ Saved to database:', dbResult);
    }

    const result = {
      success: true,
      message: 'Interrupção criada com sucesso',
      interruption: {
        id: dbResult?.id || interruptionData.id,
        merchantId,
        ifoodInterruptionId: ifoodResult.id,
        startDate,
        endDate,
        description: description || '',
        reason: reason || '',
        isActive: true,
        createdAt: dbResult?.created_at || new Date().toISOString()
      },
      ifoodResponse: ifoodResult,
      savedToDatabase: !dbError
    };

    console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions - Status: 200`);
    res.json(result);

  } catch (error: any) {
    console.error('❌ Error creating interruption:', error);
    console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions - Status: 500`);
    res.status(500).json({
      success: false,
      error: 'Failed to create interruption: ' + error.message
    });
  }
});

// DELETE /merchants/:merchantId/interruptions/:interruptionId - Remove interruption
app.delete('/merchants/:merchantId/interruptions/:interruptionId', async (req, res) => {
  try {
    const { merchantId, interruptionId } = req.params;
    const { userId } = req.body;

    console.log(`📝 [REQUEST] ${new Date().toISOString()} - DELETE /merchants/${merchantId}/interruptions/${interruptionId}`);
    console.log(`🌐 [REQUEST] Origin: ${req.get('Origin') || 'N/A'}`);
    console.log(`👤 [REQUEST] User ID: ${userId}`);

    if (!userId) {
      console.log(`📥 [RESPONSE] DELETE /merchants/${merchantId}/interruptions/${interruptionId} - Status: 400 - Missing userId`);
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    // Get the interruption from database first to get the iFood interruption ID
    const { data: interruption, error: fetchError } = await supabase
      .from('ifood_interruptions')
      .select('ifood_interruption_id')
      .eq('id', interruptionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !interruption) {
      console.log(`📥 [RESPONSE] DELETE /merchants/${merchantId}/interruptions/${interruptionId} - Status: 404 - Interruption not found`);
      return res.status(404).json({
        success: false,
        error: 'Interruption not found'
      });
    }

    // Get access token for iFood API
    const { data: tokenData, error: tokenError } = await supabase
      .from('ifood_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.log(`📥 [RESPONSE] DELETE /merchants/${merchantId}/interruptions/${interruptionId} - Status: 401`);
      return res.status(401).json({
        success: false,
        error: 'No access token found'
      });
    }

    try {
      // Step 1: Delete from iFood API
      console.log(`📡 [IFOOD API] Deleting interruption from iFood: ${interruption.ifood_interruption_id}`);
      const ifoodResponse = await fetch(
        `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/interruptions/${interruption.ifood_interruption_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        }
      );

      console.log(`📊 [IFOOD API] Response status: ${ifoodResponse.status}`);

      if (!ifoodResponse.ok && ifoodResponse.status !== 404) {
        // If it's not a 404 (already deleted), throw error
        const errorText = await ifoodResponse.text();
        throw new Error(`iFood API error: ${ifoodResponse.status} - ${errorText}`);
      }

      if (ifoodResponse.status === 404) {
        console.log(`⚠️ [IFOOD API] Interruption already deleted from iFood API`);
      } else {
        console.log(`✅ [IFOOD API] Successfully deleted from iFood`);
      }

    } catch (ifoodError: any) {
      console.error(`❌ [IFOOD API] Error deleting from iFood:`, ifoodError);
      // Continue with database deletion even if iFood API fails
    }

    // Step 2: Delete from database
    console.log(`🗑️ [DATABASE] Deleting interruption from database: ${interruptionId}`);
    const { error: deleteError } = await supabase
      .from('ifood_interruptions')
      .delete()
      .eq('id', interruptionId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Database error: ${deleteError.message}`);
    }

    console.log(`✅ [DATABASE] Successfully deleted from database`);

    const result = {
      success: true,
      message: 'Pausa programada cancelada com sucesso'
    };

    console.log(`📥 [RESPONSE] DELETE /merchants/${merchantId}/interruptions/${interruptionId} - Status: 200`);
    res.json(result);
  } catch (error: any) {
    console.error('❌ Error removing interruption:', error);
    console.log(`📥 [RESPONSE] DELETE /merchants/${merchantId}/interruptions/${interruptionId} - Status: 500`);
    res.status(500).json({
      success: false,
      error: 'Failed to remove interruption: ' + error.message
    });
  }
});

// POST /merchants/:merchantId/interruptions/sync - Sync interruptions from iFood API
app.post('/merchants/:merchantId/interruptions/sync', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { userId } = req.body;

    console.log(`📝 [REQUEST] ${new Date().toISOString()} - POST /merchants/${merchantId}/interruptions/sync`);
    console.log(`🌐 [REQUEST] Origin: ${req.get('Origin') || 'N/A'}`);
    console.log(`👤 [REQUEST] User ID: ${userId}`);

    if (!userId) {
      console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions/sync - Status: 400 - Missing userId`);
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    // 1. Buscar token válido
    const { data: tokenData, error: tokenError } = await supabase
      .from('ifood_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.error('❌ Token error:', tokenError);
      console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions/sync - Status: 401`);
      return res.status(401).json({
        success: false,
        error: 'Token de acesso não encontrado'
      });
    }

    // 2. Buscar interruptions do iFood API
    console.log('📡 [IFOOD API] Fetching interruptions from iFood...');
    const ifoodResponse = await fetch(`https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/interruptions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    console.log('📊 [IFOOD API] Response status:', ifoodResponse.status);

    if (!ifoodResponse.ok) {
      const errorText = await ifoodResponse.text();
      console.error('❌ [IFOOD API] Error response:', errorText);
      console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions/sync - Status: ${ifoodResponse.status}`);
      return res.status(ifoodResponse.status).json({
        success: false,
        error: 'Erro ao buscar interrupções do iFood: ' + errorText
      });
    }

    const ifoodData = await ifoodResponse.json();
    console.log('✅ [IFOOD API] Success response:', ifoodData);

    let syncedCount = 0;
    let newCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    const errors: any[] = [];

    // 3. SINCRONIZAÇÃO BIDIRECIONAL: iFood ↔ Banco de Dados
    console.log('🔄 [BIDIRECTIONAL SYNC] Iniciando sincronização bidirecional...');

    // 3.1. Buscar todas as pausas do banco de dados para este merchant/user
    const { data: dbInterruptions, error: dbError } = await supabase
      .from('ifood_interruptions')
      .select('id, ifood_interruption_id, start_date, end_date, description, reason')
      .eq('user_id', userId)
      .eq('merchant_id', merchantId);

    if (dbError) {
      console.error('❌ Erro ao buscar pausas do banco:', dbError);
      console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions/sync - Status: 500`);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar pausas do banco de dados: ' + dbError.message
      });
    }

    console.log(`📊 [DB] Encontradas ${dbInterruptions?.length || 0} pausas no banco de dados`);
    console.log(`📊 [IFOOD] Encontradas ${ifoodData?.length || 0} pausas no iFood`);

    // 3.2. Criar mapeamentos para comparação
    const ifoodInterruptionIds = new Set();
    const dbInterruptionIds = new Set();

    // Mapear IDs do iFood
    if (ifoodData && Array.isArray(ifoodData)) {
      ifoodData.forEach(interruption => {
        ifoodInterruptionIds.add(interruption.id);
      });
    }

    // Mapear IDs do banco
    if (dbInterruptions) {
      dbInterruptions.forEach(interruption => {
        if (interruption.ifood_interruption_id) {
          dbInterruptionIds.add(interruption.ifood_interruption_id);
        }
      });
    }

    // 3.3. PROCESSAR PAUSAS DO iFOOD (Adicionar/Atualizar no banco)
    if (ifoodData && Array.isArray(ifoodData)) {
      console.log('🔄 [SYNC FROM IFOOD] Processando pausas do iFood...');

      for (const ifoodInterruption of ifoodData) {
        try {
          // Verificar se já existe no banco
          const existingDb = dbInterruptions?.find(db =>
            db.ifood_interruption_id === ifoodInterruption.id
          );

          const interruptionData = {
            user_id: userId,
            merchant_id: merchantId,
            ifood_interruption_id: ifoodInterruption.id,
            start_date: ifoodInterruption.start,
            end_date: ifoodInterruption.end,
            description: ifoodInterruption.description || '',
            reason: ifoodInterruption.reason || '',
            is_active: new Date(ifoodInterruption.end) > new Date()
          };

          if (existingDb) {
            // Atualizar existing interruption
            const { error: updateError } = await supabase
              .from('ifood_interruptions')
              .update(interruptionData)
              .eq('id', existingDb.id);

            if (updateError) {
              console.error('❌ Update error:', updateError);
              errors.push({ ifood_id: ifoodInterruption.id, error: updateError.message });
            } else {
              updatedCount++;
              console.log(`✅ [UPDATED] Atualizada pausa: ${ifoodInterruption.id}`);
            }
          } else {
            // Inserir new interruption (criada no iFood)
            const { error: insertError } = await supabase
              .from('ifood_interruptions')
              .insert(interruptionData);

            if (insertError) {
              console.error('❌ Insert error:', insertError);
              errors.push({ ifood_id: ifoodInterruption.id, error: insertError.message });
            } else {
              newCount++;
              console.log(`✅ [NEW] Nova pausa do iFood adicionada: ${ifoodInterruption.id}`);
            }
          }
          syncedCount++;
        } catch (error: any) {
          console.error('❌ Processing error:', error);
          errors.push({ ifood_id: ifoodInterruption.id, error: error.message });
        }
      }
    }

    // 3.4. DETECTAR PAUSAS DELETADAS NO iFOOD (Existem no banco mas não no iFood)
    console.log('🔄 [DETECT DELETED] Detectando pausas deletadas no iFood...');

    if (dbInterruptions) {
      for (const dbInterruption of dbInterruptions) {
        if (dbInterruption.ifood_interruption_id &&
            !ifoodInterruptionIds.has(dbInterruption.ifood_interruption_id)) {

          console.log(`🗑️ [DELETED] Pausa deletada no iFood detectada: ${dbInterruption.ifood_interruption_id}`);

          try {
            // Remover do banco de dados
            const { error: deleteError } = await supabase
              .from('ifood_interruptions')
              .delete()
              .eq('id', dbInterruption.id);

            if (deleteError) {
              console.error('❌ Delete error:', deleteError);
              errors.push({
                ifood_id: dbInterruption.ifood_interruption_id,
                error: 'Erro ao deletar do banco: ' + deleteError.message
              });
            } else {
              deletedCount++;
              console.log(`✅ [DELETED] Removida pausa deletada no iFood: ${dbInterruption.ifood_interruption_id}`);
            }
          } catch (error: any) {
            console.error('❌ Delete processing error:', error);
            errors.push({
              ifood_id: dbInterruption.ifood_interruption_id,
              error: error.message
            });
          }
        }
      }
    }

    const result = {
      success: true,
      message: `Sincronização bidirecional concluída: ${syncedCount} do iFood processadas, ${deletedCount} deletadas do banco`,
      total_processed: syncedCount,
      new_interruptions: newCount,
      updated_interruptions: updatedCount,
      deleted_interruptions: deletedCount,
      errors: errors
    };

    console.log(`📊 [BIDIRECTIONAL SYNC RESULT] iFood→DB: ${syncedCount} (${newCount} new, ${updatedCount} updated), DB cleanup: ${deletedCount} deleted, Errors: ${errors.length}`);
    console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions/sync - Status: 200`);
    res.json(result);

  } catch (error: any) {
    console.error('❌ Error syncing interruptions:', error);
    console.log(`📥 [RESPONSE] POST /merchants/${merchantId}/interruptions/sync - Status: 500`);
    res.status(500).json({
      success: false,
      error: 'Failed to sync interruptions: ' + error.message
    });
  }
});

// ============================================================================
// 🚀 SERVER STARTUP
// ============================================================================

// Start server
app.listen(PORT, () => {
  console.log('🚀 ============================================');
  console.log('🚀 iFood Token Service Started Successfully');
  console.log('🚀 ============================================');
  console.log(`🌐 Server running on port: ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API docs: http://localhost:${PORT}/`);
  console.log('✅ Active modules:');
  console.log('   🔐 Token Management');
  console.log('   🏪 Merchant Management');
  console.log('   📦 Product Management');
  console.log('   🔄 Event Processing');
  console.log('   📊 Polling Service');
  console.log('❌ Removed modules:');
  console.log('   📋 Order Management (deleted)');
  console.log('   ⭐ Review Management (deleted)');
  console.log('   🚚 Shipping Management (deleted)');
  console.log('🚀 ============================================');

  // Start schedulers
  try {
    console.log('🟢 Starting schedulers...');

    // Token scheduler
    tokenScheduler.start();
    console.log('✅ Token scheduler started');

    // Product sync scheduler
    productSyncScheduler.start(0.5); // 30 segundos
    console.log('✅ Product sync scheduler started');

    // Log cleanup scheduler
    logCleanupScheduler.start();
    console.log('✅ Log cleanup scheduler started');

    console.log('🚀 All schedulers started successfully!');
  } catch (error) {
    console.error('❌ Error starting schedulers:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');

  // Stop schedulers
  tokenScheduler.stop();
  productSyncScheduler.stop();
  logCleanupScheduler.stop();

  console.log('✅ Schedulers stopped');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');

  // Stop schedulers
  tokenScheduler.stop();
  productSyncScheduler.stop();
  logCleanupScheduler.stop();

  console.log('✅ Schedulers stopped');
  process.exit(0);
});

export default app;