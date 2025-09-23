import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export class LogCleanupScheduler {
  private supabase: any;
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for Log Cleanup Scheduler');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Start the log cleanup scheduler
   * Executes every day at 6:00 AM
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Log cleanup scheduler is already running');
      return;
    }

    console.log('🧹 ===================================');
    console.log('🗑️ Starting Log Cleanup Scheduler');
    console.log('⏰ Schedule: Every day at 6:00 AM');
    console.log('🎯 Target: ifood_polling_log table');
    console.log('🧹 ===================================');

    // Cron expression: "0 6 * * *" = Every day at 6:00 AM
    this.cronJob = cron.schedule('0 6 * * *', async () => {
      await this.cleanupPollingLogs();
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo" // Adjust timezone as needed
    });

    this.isRunning = true;
    console.log('✅ Log cleanup scheduler started successfully');
    console.log(`🕕 Next cleanup will be executed at 6:00 AM`);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      (this.cronJob as any).stop();
      this.cronJob = null;
      this.isRunning = false;
      console.log('🛑 Log cleanup scheduler stopped');
    }
  }

  /**
   * Manual cleanup execution (for testing)
   */
  async executeCleanup(): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log('🧹 Manual cleanup execution requested...');
    return await this.cleanupPollingLogs();
  }

  /**
   * Clean up polling logs from the database
   */
  private async cleanupPollingLogs(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('');
      console.log('🧹 ===================================');
      console.log(`🗑️ DAILY LOG CLEANUP started at ${new Date().toISOString()}`);
      console.log('🎯 Target: ifood_polling_log table');
      console.log('🧹 ===================================');

      // Check if table exists by trying to count records
      const { count: beforeCount, error: countError } = await this.supabase
        .from('ifood_polling_log')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        // Table might not exist, let's check the error
        if (countError.message.includes('relation') && countError.message.includes('does not exist')) {
          console.log('ℹ️ Table ifood_polling_log does not exist yet - nothing to clean');
          return {
            success: true,
            data: {
              logs_before: 0,
              logs_deleted: 0,
              logs_remaining: 0,
              cleanup_time: new Date().toISOString(),
              message: 'Table does not exist yet'
            }
          };
        }
        throw new Error(`Error accessing logs table: ${countError.message}`);
      }

      console.log(`📊 Current logs in database: ${beforeCount || 0}`);

      // If no logs, nothing to delete
      if (!beforeCount || beforeCount === 0) {
        console.log('ℹ️ No logs found to clean up');
        return {
          success: true,
          data: {
            logs_before: 0,
            logs_deleted: 0,
            logs_remaining: 0,
            cleanup_time: new Date().toISOString(),
            message: 'No logs to clean'
          }
        };
      }

      // Delete all records by using a condition that matches all records
      // Try using timestamp field instead of ID to avoid UUID issues
      const { error: deleteError } = await this.supabase
        .from('ifood_polling_log')
        .delete()
        .lt('created_at', '2030-01-01T00:00:00Z'); // This should match all current records

      if (deleteError) {
        console.warn(`⚠️ Direct delete failed, trying alternative method: ${deleteError.message}`);
        
        // Alternative: Use batch deletion by fetching IDs first
        try {
          const { data: logIds, error: fetchError } = await this.supabase
            .from('ifood_polling_log')
            .select('id')
            .limit(1000); // Process in smaller batches
          
          if (fetchError) {
            throw new Error(`Failed to fetch log IDs: ${fetchError.message}`);
          }
          
          if (logIds && logIds.length > 0) {
            // Delete in batches
            const batchSize = 100;
            let totalDeleted = 0;
            
            for (let i = 0; i < logIds.length; i += batchSize) {
              const batch = logIds.slice(i, i + batchSize);
              const ids = batch.map(log => log.id);
              
              const { error: batchDeleteError } = await this.supabase
                .from('ifood_polling_log')
                .delete()
                .in('id', ids);
              
              if (batchDeleteError) {
                console.warn(`⚠️ Batch ${i}-${i + batch.length} failed: ${batchDeleteError.message}`);
                continue;
              }
              
              totalDeleted += batch.length;
              console.log(`🗑️ Deleted batch: ${batch.length} logs (total: ${totalDeleted})`);
              
              // Add small delay to avoid overwhelming the database
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`✅ Batch deletion completed: ${totalDeleted} logs deleted`);
          }
        } catch (batchError: any) {
          console.error(`❌ Batch deletion also failed: ${batchError.message}`);
          
          return {
            success: false,
            error: `All cleanup methods failed. TRUNCATE: ${deleteError.message}, Batch: ${batchError.message}`
          };
        }
      }

      console.log(`🗑️ Executed delete operation for all records`);
      const deletedCount = beforeCount;

      // Verify deletion
      const { count: afterCount, error: verifyError } = await this.supabase
        .from('ifood_polling_log')
        .select('*', { count: 'exact', head: true });

      if (verifyError) {
        console.warn('⚠️ Could not verify deletion:', verifyError.message);
      }

      const actualDeleted = (beforeCount || 0) - (afterCount || 0);

      console.log('✅ Log cleanup completed successfully');
      console.log(`📊 Cleanup Statistics:`);
      console.log(`   - Logs before cleanup: ${beforeCount || 0}`);
      console.log(`   - Logs deleted: ${actualDeleted}`);
      console.log(`   - Logs remaining: ${afterCount || 0}`);

      if (actualDeleted > 0) {
        console.log('💚 Database space freed up successfully!');
      } else {
        console.log('ℹ️ No logs were found to clean up');
      }

      console.log('🧹 ===================================');
      console.log(`🕕 Next cleanup scheduled for tomorrow at 6:00 AM`);
      console.log('🧹 ===================================');
      console.log('');

      return {
        success: true,
        data: {
          logs_before: beforeCount || 0,
          logs_deleted: actualDeleted,
          logs_remaining: afterCount || 0,
          cleanup_time: new Date().toISOString()
        }
      };

    } catch (error: any) {
      console.error('❌ Log cleanup failed:', error.message);
      console.log('🧹 ===================================');
      console.log('');
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { 
    running: boolean; 
    nextCleanup: string;
    schedule: string;
    timezone: string;
  } {
    const nextCleanup = this.isRunning 
      ? this.getNextCleanupTime() 
      : 'Scheduler not running';

    return {
      running: this.isRunning,
      nextCleanup,
      schedule: 'Daily at 6:00 AM',
      timezone: 'America/Sao_Paulo'
    };
  }

  /**
   * Calculate next cleanup time
   */
  private getNextCleanupTime(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0); // 6:00 AM

    // If it's before 6 AM today, next cleanup is today at 6 AM
    const todayAt6AM = new Date(now);
    todayAt6AM.setHours(6, 0, 0, 0);
    
    if (now < todayAt6AM) {
      return todayAt6AM.toISOString();
    }
    
    return tomorrow.toISOString();
  }
}

// Create a singleton instance
export const logCleanupScheduler = new LogCleanupScheduler();