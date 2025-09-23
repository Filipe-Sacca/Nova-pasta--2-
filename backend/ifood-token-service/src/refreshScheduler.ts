import dotenv from 'dotenv';
import { IFoodTokenRefreshService } from './tokenRefreshService';

// Load environment variables
dotenv.config();

async function startRefreshScheduler() {
  console.log('🚀 iFood Token Refresh Scheduler Starting...\n');

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('  - SUPABASE_URL:', !!supabaseUrl);
    console.error('  - SUPABASE_ANON_KEY:', !!supabaseKey);
    console.error('\n💡 Please check your .env file');
    process.exit(1);
  }

  console.log('✅ Environment configured:');
  console.log(`  - Supabase URL: ${supabaseUrl}`);
  console.log(`  - Supabase Key: ${'*'.repeat(10)}${supabaseKey.slice(-10)}`);
  console.log('');

  try {
    // Initialize and start the refresh service
    const refreshService = new IFoodTokenRefreshService(supabaseUrl, supabaseKey);
    refreshService.startScheduler();

    // Keep the process running
    console.log('🔄 Service running... Press Ctrl+C to stop\n');

  } catch (error: any) {
    console.error('❌ Failed to start refresh service:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down token refresh scheduler...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down token refresh scheduler...');
  process.exit(0);
});

// Start the scheduler
startRefreshScheduler();