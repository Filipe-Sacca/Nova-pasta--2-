import cron from 'node-cron';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

interface TokenRecord {
  id: number;
  client_id: string;
  client_secret: string;
  access_token: string;
  expires_at: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface RefreshResult {
  success: boolean;
  client_id: string;
  new_token?: string;
  error?: string;
  updated_at?: string;
}

export class IFoodTokenRefreshService {
  private supabase;
  private readonly IFOOD_TOKEN_URL = 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token';
  private readonly GRANT_TYPE = 'client_credentials';

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get all tokens from ifood_tokens table
   * Replicates: "Get many rows" node from N8N
   */
  async getAllTokens(): Promise<TokenRecord[]> {
    try {
      console.log('📊 Fetching all tokens from database...');

      const { data, error } = await this.supabase
        .from('ifood_tokens')
        .select('*');

      if (error) {
        console.error('❌ Error fetching tokens:', error);
        return [];
      }

      console.log(`✅ Found ${data.length} tokens in database`);
      return data as TokenRecord[];

    } catch (error) {
      console.error('❌ Error fetching tokens from database:', error);
      return [];
    }
  }

  /**
   * Refresh a single token via iFood API
   * Replicates: "[Client Credentials]" node from N8N
   */
  async refreshSingleToken(token: TokenRecord): Promise<RefreshResult> {
    try {
      console.log(`🔄 Refreshing token for client_id: ${token.client_id.substring(0, 8)}...`);

      const payload = new URLSearchParams({
        grantType: this.GRANT_TYPE,
        clientId: token.client_id,
        clientSecret: token.client_secret
      });

      const headers = {
        'accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      const response = await axios.post(this.IFOOD_TOKEN_URL, payload, { headers });

      if (response.status === 200) {
        const newAccessToken = response.data.accessToken;
        const updatedAt = new Date().toISOString();

        console.log(`✅ New token generated for ${token.client_id.substring(0, 8)}`);
        return {
          success: true,
          client_id: token.client_id,
          new_token: newAccessToken,
          updated_at: updatedAt
        };
      } else {
        const errorMsg = `iFood API error: ${response.status} - ${response.statusText}`;
        console.error(`❌ ${errorMsg}`);
        return {
          success: false,
          client_id: token.client_id,
          error: errorMsg
        };
      }

    } catch (error: any) {
      let errorMsg = 'Error refreshing token';
      
      if (error.response) {
        errorMsg = `iFood API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
      } else if (error.request) {
        errorMsg = 'Network error: Unable to reach iFood API';
      } else {
        errorMsg = error.message || 'Unknown error refreshing token';
      }

      console.error(`❌ ${errorMsg}`);
      return {
        success: false,
        client_id: token.client_id,
        error: errorMsg
      };
    }
  }

  /**
   * Update token in database
   * Replicates: "Atualiza Token de Acesso" node from N8N
   */
  async updateTokenInDatabase(result: RefreshResult): Promise<boolean> {
    if (!result.success) {
      return false;
    }

    try {
      console.log(`💾 Updating token in database for ${result.client_id.substring(0, 8)}...`);

      const { error } = await this.supabase
        .from('ifood_tokens')
        .update({
          access_token: result.new_token,
          updated_at: result.updated_at
        })
        .eq('client_id', result.client_id);

      if (error) {
        console.error('❌ Database update error:', error);
        return false;
      }

      console.log('✅ Token updated successfully in database');
      return true;

    } catch (error) {
      console.error('❌ Error updating token in database:', error);
      return false;
    }
  }

  /**
   * Main method to refresh all tokens
   * Replicates the complete N8N workflow
   */
  async refreshAllTokens(): Promise<{ total: number; successful: number; failed: number }> {
    console.log('🚀 Starting token refresh job...');

    const stats = {
      total: 0,
      successful: 0,
      failed: 0
    };

    try {
      // Step 1: Get all tokens from database
      const tokens = await this.getAllTokens();
      stats.total = tokens.length;

      if (tokens.length === 0) {
        console.log('📭 No tokens found in database');
        return stats;
      }

      // Step 2: Refresh each token
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        console.log(`Processing token ${i + 1}/${tokens.length}`);

        // Step 2a: Refresh token via iFood API
        const refreshResult = await this.refreshSingleToken(token);

        if (refreshResult.success) {
          // Step 2b: Update token in database
          if (await this.updateTokenInDatabase(refreshResult)) {
            stats.successful++;
          } else {
            stats.failed++;
          }
        } else {
          stats.failed++;
        }

        // Small delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Final statistics
      console.log('📊 Token refresh job completed:');
      console.log(`  Total tokens: ${stats.total}`);
      console.log(`  Successful: ${stats.successful}`);
      console.log(`  Failed: ${stats.failed}`);

      return stats;

    } catch (error) {
      console.error('❌ Error in refresh job:', error);
      stats.failed = stats.total;
      return stats;
    }
  }

  /**
   * Start the scheduled token refresh service
   * Replicates: Schedule Trigger (every 2 hours at minute 50) from N8N
   */
  startScheduler(): void {
    console.log('⏰ Starting iFood Token Refresh Scheduler...');
    console.log('📅 Schedule: Every 2 hours at minute 50');

    // Schedule job every 2 hours at minute 50
    // This replicates the N8N schedule exactly: '50 */2 * * *'
    cron.schedule('50 */2 * * *', async () => {
      console.log(`🕐 Scheduled refresh job triggered at ${new Date().toISOString()}`);
      await this.refreshAllTokens();
    });

    // Also run immediately for testing (optional)
    console.log('🧪 Running initial refresh job...');
    this.refreshAllTokens();

    console.log('🔄 Scheduler started. Service will run every 2 hours at minute 50');
    console.log('   Next runs: 00:50, 02:50, 04:50, 06:50, 08:50, 10:50, etc.');
  }
}