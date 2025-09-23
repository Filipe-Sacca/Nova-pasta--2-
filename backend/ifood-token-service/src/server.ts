import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route modules
import menuRoutes from './routes/menuRoutes';
import imageRoutes from './routes/imageRoutes';
import tokenRoutes from './routes/tokenRoutes';
import merchantRoutes from './routes/merchantRoutes';
import statusRoutes from './routes/statusRoutes';
import interruptionRoutes from './routes/interruptionRoutes';
import schedulerRoutes from './routes/schedulerRoutes';

// Import schedulers for initialization
import { tokenScheduler } from './tokenScheduler';
import { productSyncScheduler } from './productSyncScheduler';
import { logCleanupScheduler } from './logCleanupScheduler';

// ============================================================================
// 🚀 REFACTORED IFOOD TOKEN SERVICE - MODULAR ARCHITECTURE
// ============================================================================
// Organized modules: Token, Merchant, Product/Menu, Status, Interruptions, Schedulers
// Clean separation of concerns and maintainable structure
// ============================================================================

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8092;

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
      menuRoutes: 'Product sync, categories, smart sync',
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

// ============================================================================
// 📁 ROUTE MODULE REGISTRATION
// ============================================================================

// Register all route modules
app.use('/', tokenRoutes);          // 🔐 Token management
app.use('/', merchantRoutes);       // 🏪 Merchant operations
app.use('/', statusRoutes);         // 🟢 Status monitoring
app.use('/', interruptionRoutes);   // 📅 Interruptions
app.use('/', schedulerRoutes);      // 📦 Schedulers
app.use('/', menuRoutes);           // 🍽️ Product/Menu operations
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

const server = app.listen(PORT, () => {
  console.log('\n🎯 ============================================');
  console.log('🚀 iFood Token Service - Modular Architecture');
  console.log('🎯 ============================================');
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API docs: http://localhost:${PORT}/`);
  console.log('📁 Active modules:');
  console.log('   🔐 Token Management (tokenRoutes)');
  console.log('   🏪 Merchant Operations (merchantRoutes)');
  console.log('   🟢 Status Monitoring (statusRoutes)');
  console.log('   📅 Interruptions (interruptionRoutes)');
  console.log('   📦 Schedulers (schedulerRoutes)');
  console.log('   🍽️ Product/Menu (menuRoutes)');
  console.log('   🖼️ Image Management (imageRoutes)');
  console.log('🎯 ============================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');

  // Stop all schedulers
  tokenScheduler.stop();
  productSyncScheduler.stop();
  logCleanupScheduler.stop();

  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');

  // Stop all schedulers
  tokenScheduler.stop();
  productSyncScheduler.stop();
  logCleanupScheduler.stop();

  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

export default app;