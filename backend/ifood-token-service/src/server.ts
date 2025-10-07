import express from 'express';
import dotenv from 'dotenv';

// Import route modules
import { createMenuRoutes } from './routes/menuRoutes';
import { createImageRoutes } from './routes/imageRoutes';
import tokenRoutes from './routes/tokenRoutes';
import merchantRoutes from './routes/merchantRoutes';
import statusRoutes from './routes/statusRoutes';
import interruptionRoutes from './routes/interruptionRoutes';
import openingHoursRoutes from './routes/openingHoursRoutes';
import schedulerRoutes from './routes/schedulerRoutes';
import qrcodeRoutes from './routes/qrcodeRoutes';
import { createClient } from '@supabase/supabase-js';

// Import schedulers for initialization
import { tokenScheduler } from './tokenScheduler';
import { productSyncScheduler } from './productSyncScheduler';
import { logCleanupScheduler } from './logCleanupScheduler';
import { MerchantPollingService } from './merchantPollingService';

// ============================================================================
// 🚀 REFACTORED IFOOD TOKEN SERVICE - MODULAR ARCHITECTURE
// ============================================================================
// Organized modules: Token, Merchant, Product/Menu, Status, Interruptions, Schedulers
// Clean separation of concerns and maintainable structure
// ============================================================================

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 8093;

app.use(express.json({ limit: '10mb' }));

// Configure CORS - Allow all origins for development
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  console.log('🌐 [CORS] Setting headers for origin:', origin);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');

  if (req.method === 'OPTIONS') {
    console.log('🌐 [CORS] Handling OPTIONS request');
    res.status(200).end();
    return;
  }

  next();
});

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
    version: '2.1.0',
    status: 'online',
    architecture: 'Modular',
    activeModules: [
      'Token Management',
      'Merchant Management',
      'Product/Menu Management',
      'Status Monitoring',
      'Interruptions Management',
      'Scheduler Services',
      'Image Management'
    ],
    moduleStructure: {
      menuRoutes: 'Product categories, menu management',
      imageRoutes: 'Product images, status updates',
      tokenRoutes: 'Token CRUD, refresh, scheduler',
      merchantRoutes: 'Merchant operations, sync',
      statusRoutes: 'Status monitoring, scheduler',
      interruptionRoutes: 'Interruption management',
      schedulerRoutes: 'Product sync scheduler'
    },
    endpoints: {
      health: 'GET /health',
      documentation: 'All endpoints available through respective modules'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '2.1.0'
  });
});

// TESTE SUPER SIMPLES
app.get('/test-basic', (req, res) => {
  console.log('🧪 [TEST-BASIC] Endpoint hit!');
  res.json({ success: true, message: 'Basic test working!' });
});


// ============================================================================
// 📁 ROUTE MODULE REGISTRATION
// ============================================================================

// Initialize route dependencies
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Create menuRoutes with dependencies
console.log('🔧 [DEBUG] Creating menuRoutes with dependencies...');
const menuRoutes = createMenuRoutes({ supabase, supabaseUrl, supabaseKey });
console.log('✅ [DEBUG] menuRoutes created:', !!menuRoutes);

// Create imageRoutes with dependencies
console.log('🔧 [DEBUG] Creating imageRoutes with dependencies...');
const imageRoutes = createImageRoutes({ supabase, supabaseUrl, supabaseKey });
console.log('✅ [DEBUG] imageRoutes created:', !!imageRoutes);

// simpleSyncRoutes REMOVED - not needed

// Register all route modules
app.use('/', tokenRoutes);          // 🔐 Token management
app.use('/', merchantRoutes);       // 🏪 Merchant operations
app.use('/', statusRoutes);         // 🟢 Status monitoring
app.use('/', interruptionRoutes);   // 📅 Interruptions
app.use('/', openingHoursRoutes);   // 🕐 Opening Hours
app.use('/', schedulerRoutes);      // 📦 Schedulers
app.use('/', qrcodeRoutes);         // 🔗 QR Code Generation
app.use('/', menuRoutes);           // 🍽️ Product/Menu operations - REACTIVATED

// Debug endpoints for testing
app.get('/debug-test', (req, res) => {
  console.log('🧪 [DEBUG-TEST] Direct endpoint hit!');
  res.json({ success: true, message: 'Direct test working!' });
});

// simpleSyncRoutes REMOVED completely
app.use('/', imageRoutes);          // 🖼️ Image management

// ============================================================================
// 🚦 ERROR HANDLING
// ============================================================================

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('🚨 [ERROR] Global error handler:', err);

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    hint: 'Check the API documentation for available endpoints'
  });
});


// ============================================================================
// 🚀 SERVER STARTUP
// ============================================================================

// Initialize merchant polling service
const merchantPolling = new MerchantPollingService();

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log('\n🎯 ============================================');
  console.log('🚀 iFood Token Service - Modular Architecture');
  console.log('🎯 ============================================');
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 Health check: https://app.planocertodelivery.com/api/health`);
  console.log(`📋 API docs: https://app.planocertodelivery.com/api/`);
  console.log('📁 Active modules:');
  console.log('   🔐 Token Management (tokenRoutes)');
  console.log('   🏪 Merchant Operations (merchantRoutes)');
  console.log('   🟢 Status Monitoring (statusRoutes)');
  console.log('   📅 Interruptions (interruptionRoutes)');
  console.log('   🕐 Opening Hours (openingHoursRoutes)');
  console.log('   📦 Schedulers (schedulerRoutes)');
  console.log('   🍽️ Product/Menu (menuRoutes) - REACTIVATED');
  console.log('   🖼️ Image Management (imageRoutes)');
  console.log('   🔄 Merchant Polling (30s intervals)');
  console.log('🎯 ============================================\n');

  // Start merchant polling service
  try {
    await merchantPolling.start();
    console.log('✅ Merchant polling service started successfully');
  } catch (error) {
    console.error('❌ Failed to start merchant polling service:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');

  // Stop all schedulers and polling
  tokenScheduler.stop();
  productSyncScheduler.stop();
  logCleanupScheduler.stop();
  merchantPolling.stop();

  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');

  // Stop all schedulers and polling
  tokenScheduler.stop();
  productSyncScheduler.stop();
  logCleanupScheduler.stop();
  merchantPolling.stop();

  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

export default app;