import { IFoodTokenService } from './ifoodTokenService';
import dotenv from 'dotenv';

dotenv.config();

export class TokenScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private service: IFoodTokenService;
  private isRunning: boolean = false;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    this.service = new IFoodTokenService(supabaseUrl, supabaseKey);
  }

  /**
   * Start the automatic token renewal scheduler
   * @param intervalMinutes - Interval in minutes between renewals (default: 180 minutes / 3 hours)
   */
  start(intervalMinutes: number = 180): void {
    if (this.isRunning) {
      console.log('⚠️ Token scheduler is already running');
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    
    console.log('🚀 ===================================');
    console.log('⏰ Starting Token Mandatory Renewal Scheduler');
    console.log(`📅 Interval: ${intervalMinutes} minutes (every 3 hours)`);
    console.log(`🔄 Strategy: Mandatory renewal every 3 hours + expiring tokens check`);
    console.log(`🕐 Next renewal in: ${intervalMinutes} minutes`);
    console.log('🚀 ===================================');

    // Run immediately on start
    this.checkAndUpdateTokens();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkAndUpdateTokens();
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
      this.isRunning = false;
      console.log('🛑 Token scheduler stopped');
    }
  }

  /**
   * Mandatory token renewal every 3 hours (forces renewal of ALL tokens)
   */
  private async checkAndUpdateTokens(): Promise<void> {
    try {
      console.log('');
      console.log('🔄 ===================================');
      console.log(`🕐 MANDATORY token renewal started at ${new Date().toISOString()}`);
      console.log(`⚠️ POLICY: All tokens MUST be renewed every 3 hours`);
      console.log('🔄 ===================================');

      // Mandatory renewal: ALL tokens must be renewed every 3 hours
      console.log('🔄 Starting mandatory renewal of ALL tokens...');
      
      const renewResult = await this.service.updateAllExpiredTokens();
      
      if (renewResult.success) {
        const renewData = renewResult.data as any;
        console.log('✅ Mandatory token renewal completed successfully');
        console.log(`📊 Renewal Statistics:`);
        console.log(`   - Total tokens in database: ${renewData.total_tokens}`);
        console.log(`   - Tokens renewed: ${renewData.updated_tokens}`);
        console.log(`   - Failed renewals: ${renewData.failed_updates}`);
        
        if (renewData.updated_tokens === renewData.total_tokens) {
          console.log('💚 All tokens renewed successfully!');
        } else if (renewData.failed_updates > 0) {
          console.log('⚠️ Some tokens failed to renew:');
          renewData.errors.forEach((error: string) => console.log(`   - ${error}`));
        }
      } else {
        console.error('❌ Mandatory token renewal failed:', renewResult.error);
      }

      console.log('🔄 ===================================');
      console.log(`🕐 Next mandatory renewal scheduled for ${this.getNextCheckTime()}`);
      console.log('🔄 ===================================');
      console.log('');
    } catch (error) {
      console.error('❌ Unexpected error during mandatory token renewal:', error);
    }
  }

  /**
   * Get the next check time based on current interval
   */
  private getNextCheckTime(): string {
    if (!this.intervalId) return 'Scheduler not running';
    
    // Get interval in milliseconds from the stored timeout
    const intervalMs = 180 * 60 * 1000; // 3 hours mandatory renewal
    const nextCheck = new Date(Date.now() + intervalMs);
    return nextCheck.toISOString();
  }

  /**
   * Get scheduler status
   */
  getStatus(): { running: boolean; nextCheck: string } {
    return {
      running: this.isRunning,
      nextCheck: this.isRunning ? this.getNextCheckTime() : 'Not scheduled'
    };
  }
}

// Create a singleton instance
export const tokenScheduler = new TokenScheduler();