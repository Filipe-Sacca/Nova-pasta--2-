import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

export class ProductSyncScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private supabase: any;
  private baseUrl: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.baseUrl = `http://localhost:${process.env.PORT || 8085}`;
  }

  /**
   * Start the automatic product sync scheduler
   * @param intervalMinutes - Interval in minutes between syncs (default: 30 minutes)
   */
  start(intervalMinutes: number = 30): void {
    if (this.isRunning) {
      console.log('⚠️ Product sync scheduler is already running');
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    console.log('🚀 ===================================');
    console.log('📦 Starting Product Sync Scheduler');
    console.log(`📅 Interval: ${intervalMinutes} minutes`);
    console.log(`🔄 Strategy: Complete sync of ALL product data from iFood Catalog API`);
    console.log(`📊 Updates: Name, price, status, description, category, images`);
    console.log(`🕐 Next sync in: ${intervalMinutes} minutes`);
    console.log('🚀 ===================================');

    // Run immediately on start
    this.syncAllProducts();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.syncAllProducts();
    }, intervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Product sync scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.intervalId ? new Date(Date.now() + (this.intervalId as any)._idleTimeout) : null
    };
  }

  /**
   * Sync all products from all merchants
   */
  private async syncAllProducts(): Promise<void> {
    try {
      console.log('🔄 ===================================');
      console.log(`🕐 Product sync started at ${new Date().toISOString()}`);
      console.log('📦 Strategy: Complete sync of ALL product data from iFood catalog');
      console.log('📊 Syncing: Name, price, status, description, category, images');
      console.log('🔄 ===================================');

      // Get all merchants and their products
      const { data: merchants, error: merchantError } = await this.supabase
        .from('ifood_merchants')
        .select('merchant_id, user_id, name');

      if (merchantError) {
        console.error('❌ [PRODUCT SYNC] Error fetching merchants:', merchantError);
        return;
      }

      console.log(`🏪 [PRODUCT SYNC] Found ${merchants?.length || 0} merchants to sync`);

      for (const merchant of merchants || []) {
        await this.syncMerchantProducts(merchant);
        // Add small delay between merchants to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ Product sync completed successfully');
      console.log(`📊 Sync Statistics:`);
      console.log(`   - Merchants processed: ${merchants?.length || 0}`);
      console.log('🔄 ===================================');
      console.log(`🕐 Next sync scheduled for ${new Date(Date.now() + 30 * 60 * 1000).toLocaleString()}`);
      console.log('🔄 ===================================');

    } catch (error: any) {
      console.error('❌ [PRODUCT SYNC] Unhandled error:', error);
    }
  }

  /**
   * Sync products for a specific merchant
   */
  private async syncMerchantProducts(merchant: any): Promise<void> {
    try {
      console.log(`📋 [PRODUCT SYNC] Processing merchant: ${merchant.name} (${merchant.merchant_id})`);

      console.log(`📦 [PRODUCT SYNC] Syncing ALL products from iFood API for ${merchant.name}`);

      let syncedCount = 0;
      let errorCount = 0;

      // Sync ALL products for this merchant using the complete sync endpoint
      try {
        // Call the endpoint that fetches ALL product data from iFood API and updates database
        const response = await fetch(`${this.baseUrl}/merchants/${merchant.merchant_id}/products/smart-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: merchant.user_id
          })
        });

        if (response.ok) {
          const data = await response.json() as any;
          if (data.success) {
            syncedCount = data.total_products || 0;
            console.log(`✅ [PRODUCT SYNC] Synced ALL products for ${merchant.name}: ${syncedCount} products`);
            console.log(`📊 [SYNC DETAILS] New: ${data.new_products || 0}, Updated: ${data.updated_products || 0}`);
          } else {
            console.error(`❌ [PRODUCT SYNC] Sync failed for ${merchant.name}: ${data.error}`);
            errorCount = 1;
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ [PRODUCT SYNC] Failed to sync merchant ${merchant.name}: ${response.status} - ${errorText}`);
          errorCount = 1;
        }

      } catch (syncError) {
        console.error(`❌ [PRODUCT SYNC] Error syncing merchant ${merchant.name}:`, syncError);
        errorCount = 1;
      }

      console.log(`📊 [PRODUCT SYNC] Merchant ${merchant.name} completed - Synced: ${syncedCount}, Errors: ${errorCount}`);

    } catch (error) {
      console.error(`❌ [PRODUCT SYNC] Error processing merchant ${merchant.name}:`, error);
    }
  }

  /**
   * Manual sync trigger for specific merchant
   */
  async syncMerchant(merchantId: string, userId: string): Promise<{ success: boolean; synced: number; errors: number }> {
    try {
      console.log(`🔄 [MANUAL SYNC] Starting sync for merchant: ${merchantId}`);

      const { data: merchant, error: merchantError } = await this.supabase
        .from('ifood_merchants')
        .select('merchant_id, user_id, name')
        .eq('merchant_id', merchantId)
        .eq('user_id', userId)
        .single();

      if (merchantError || !merchant) {
        throw new Error('Merchant not found');
      }

      let syncedCount = 0;
      let errorCount = 0;

      // Use the complete sync endpoint that fetches ALL product data from iFood
      try {
        const response = await fetch(`${this.baseUrl}/merchants/${merchantId}/products/smart-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId
          })
        });

        if (response.ok) {
          const data = await response.json() as any;
          if (data.success) {
            syncedCount = data.total_products || 0;
            console.log(`✅ [MANUAL SYNC] Synced ALL products: ${syncedCount} products`);
            console.log(`📊 [SYNC DETAILS] New: ${data.new_products || 0}, Updated: ${data.updated_products || 0}`);
          } else {
            console.error(`❌ [MANUAL SYNC] Sync failed: ${data.error}`);
            errorCount = 1;
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ [MANUAL SYNC] Failed to sync: ${response.status} - ${errorText}`);
          errorCount = 1;
        }

      } catch (syncError) {
        console.error(`❌ [MANUAL SYNC] Error during sync:`, syncError);
        errorCount = 1;
      }

      console.log(`✅ [MANUAL SYNC] Completed - Synced: ${syncedCount}, Errors: ${errorCount}`);

      return { success: true, synced: syncedCount, errors: errorCount };

    } catch (error: any) {
      console.error('❌ [MANUAL SYNC] Error:', error);
      return { success: false, synced: 0, errors: 1 };
    }
  }
}

// Create and export singleton instance
export const productSyncScheduler = new ProductSyncScheduler();