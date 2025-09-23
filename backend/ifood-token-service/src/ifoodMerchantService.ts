import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Types
export interface MerchantRequest {
  user_id: string;
  access_token?: string;
}

export interface MerchantData {
  merchant_id: string;
  name: string;
  corporate_name: string;
  user_id: string;
  client_id: string;
  status: boolean;
  // Extended fields to match database schema
  phone?: string;
  description?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  postalCode?: string;
  address_country?: string;
  operating_hours?: any; // jsonb
  type?: string[];
  latitude?: string;
  longitude?: string;
  last_sync_at?: string;
}

export interface IFoodMerchant {
  id: string;
  name: string;
  corporateName?: string;
  [key: string]: any;
}

export interface MerchantSyncResult {
  success: boolean;
  total_merchants?: number;
  new_merchants?: string[];
  existing_merchants?: string[];
  errors?: Array<{ merchant_id: string; error: string }>;
  message?: string;
  error?: string;
}

export class IFoodMerchantService {
  private supabase;
  private readonly IFOOD_MERCHANT_URL = 'https://merchant-api.ifood.com.br/merchant/v1.0/merchants';

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get access token from database for a specific user
   */
  async getTokenFromDb(userId: string): Promise<any | null> {
    try {
      console.log(`🔍 Fetching token for user_id: ${userId}`);

      const { data, error } = await this.supabase
        .from('ifood_tokens')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching token:', error);
        return null;
      }

      if (data) {
        console.log('✅ Token found for user');
        return data;
      } else {
        console.log('📭 No token found for user');
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching token:', error);
      return null;
    }
  }

  /**
   * Fetch merchant list from iFood API
   */
  async fetchMerchantsFromIFood(accessToken: string): Promise<{ success: boolean; merchants: IFoodMerchant[] | { error: string }[] }> {
    try {
      console.log('📡 Fetching merchants from iFood API...');

      const headers = {
        'accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };

      const response = await axios.get(this.IFOOD_MERCHANT_URL, { headers });

      if (response.status === 200) {
        const merchants = response.data as IFoodMerchant[];
        console.log(`✅ Successfully fetched ${merchants.length} merchants`);
        return { success: true, merchants };
      } else {
        const errorMsg = `iFood API error: ${response.status} - ${response.statusText}`;
        console.error('❌', errorMsg);
        return { success: false, merchants: [{ error: errorMsg }] };
      }
    } catch (error: any) {
      let errorMsg = 'Error fetching merchants';
      
      if (error.response) {
        errorMsg = `iFood API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
      } else if (error.request) {
        errorMsg = 'Network error: Unable to reach iFood API';
      } else {
        errorMsg = error.message || 'Unknown error fetching merchants';
      }

      console.error('❌', errorMsg);
      return { success: false, merchants: [{ error: errorMsg }] };
    }
  }

  /**
   * Check if merchant already exists in database
   */
  async checkMerchantExists(merchantId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('ifood_merchants')
        .select('merchant_id')
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
        console.error('❌ Error checking merchant existence:', error);
        return false;
      }

      const exists = !!data;
      
      if (exists) {
        console.log(`📦 Merchant ${merchantId} already exists in database`);
      } else {
        console.log(`🆕 Merchant ${merchantId} not found in database`);
      }

      return exists;
    } catch (error) {
      console.error('❌ Error checking merchant existence:', error);
      return false;
    }
  }

  /**
   * Get all merchant IDs for a specific user
   */
  async getUserMerchantIds(userId: string): Promise<{ success: boolean; merchant_ids: string[]; error?: string }> {
    try {
      console.log(`📋 Fetching merchant IDs for user: ${userId}`);

      const { data, error } = await this.supabase
        .from('ifood_merchants')
        .select('merchant_id')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error fetching user merchants:', error);
        return {
          success: false,
          merchant_ids: [],
          error: `Database error: ${error.message}`
        };
      }

      const merchantIds = data ? data.map(row => row.merchant_id) : [];
      console.log(`📊 Found ${merchantIds.length} merchants for user ${userId}`);

      return {
        success: true,
        merchant_ids: merchantIds
      };
    } catch (error: any) {
      const errorMsg = `Error fetching user merchants: ${error.message || error}`;
      console.error('❌', errorMsg);
      return {
        success: false,
        merchant_ids: [],
        error: errorMsg
      };
    }
  }

  /**
   * Store merchant in Supabase database
   */
  async storeMerchant(merchant: MerchantData): Promise<{ success: boolean; response: any }> {
    try {
      console.log(`💾 Storing merchant ${merchant.merchant_id} in database...`);

      const { data, error } = await this.supabase
        .from('ifood_merchants')
        .insert({
          // Core fields (existing)
          merchant_id: merchant.merchant_id,
          name: merchant.name,
          corporate_name: merchant.corporate_name,
          user_id: merchant.user_id,
          client_id: merchant.client_id,
          status: merchant.status,
          
          // Extended fields (new)
          phone: merchant.phone || null,
          description: merchant.description || null,
          
          // Address fields
          address_street: merchant.address_street || null,
          address_number: merchant.address_number || null,
          address_complement: merchant.address_complement || null,
          address_neighborhood: merchant.address_neighborhood || null,
          address_city: merchant.address_city || null,
          address_state: merchant.address_state || null,
          postalCode: merchant.postalCode || null,
          address_country: merchant.address_country || null,
          
          // Business fields
          operating_hours: merchant.operating_hours || null,
          type: merchant.type || null,
          
          // Location fields
          latitude: merchant.latitude || null,
          longitude: merchant.longitude || null,
          
          // Sync timestamp
          last_sync_at: merchant.last_sync_at || new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        return { 
          success: false, 
          response: { error: `Database error: ${error.message}` }
        };
      }

      console.log(`✅ Merchant ${merchant.merchant_id} stored successfully`);
      return { 
        success: true, 
        response: { success: true, merchant_id: merchant.merchant_id, data }
      };
    } catch (error: any) {
      const errorMsg = `Error storing merchant: ${error.message || error}`;
      console.error('❌', errorMsg);
      return { 
        success: false, 
        response: { error: errorMsg }
      };
    }
  }

  /**
   * Main method to process merchant synchronization
   * Replicates the N8N workflow [MERCHANT]:
   * 1. Get access token (from parameter or database)
   * 2. Fetch merchants from iFood API
   * 3. Check each merchant against database
   * 4. Store new merchants
   * 5. Return results
   */
  async processMerchants(userId: string, accessToken?: string): Promise<MerchantSyncResult> {
    try {
      console.log('🎯 Processing merchant synchronization...');
      console.log(`👤 User ID: ${userId}`);

      // Step 1: Get access token and client_id
      let token = accessToken;
      let clientId: string | null = null;

      const tokenData = await this.getTokenFromDb(userId);
      
      if (!token) {
        if (!tokenData) {
          return {
            success: false,
            error: 'No valid token found for user'
          };
        }
        token = tokenData.access_token;
      }
      
      clientId = tokenData?.client_id || null;

      if (!clientId) {
        return {
          success: false,
          error: 'Could not determine client_id'
        };
      }

      // Step 2: Fetch merchants from iFood
      const { success, merchants } = await this.fetchMerchantsFromIFood(token!);
      
      if (!success) {
        return {
          success: false,
          error: (merchants[0] as any).error || 'Failed to fetch merchants'
        };
      }

      // Step 3 & 4: Process each merchant
      const results: MerchantSyncResult = {
        success: true,
        total_merchants: (merchants as IFoodMerchant[]).length,
        new_merchants: [],
        existing_merchants: [],
        errors: []
      };

      for (const merchantData of merchants as IFoodMerchant[]) {
        try {
          // Extract merchant information
          const merchant: MerchantData = {
            merchant_id: merchantData.id,
            name: merchantData.name,
            corporate_name: merchantData.corporateName || '',
            user_id: userId,
            client_id: clientId,
            status: true // true = available, false = unavailable/closed
          };

          // Check if merchant exists
          const exists = await this.checkMerchantExists(merchant.merchant_id);
          
          if (exists) {
            results.existing_merchants!.push(merchant.merchant_id);
          } else {
            // Store new merchant
            const { success: stored, response } = await this.storeMerchant(merchant);
            
            if (stored) {
              results.new_merchants!.push(merchant.merchant_id);
            } else {
              results.errors!.push({
                merchant_id: merchant.merchant_id,
                error: response.error
              });
            }
          }
        } catch (error: any) {
          console.error(`❌ Error processing merchant ${merchantData.id}:`, error);
          results.errors!.push({
            merchant_id: merchantData.id,
            error: error.message || 'Unknown error'
          });
        }
      }

      // Step 5: Return results
      results.message = `Processed ${results.total_merchants} merchants: ${results.new_merchants!.length} new, ${results.existing_merchants!.length} existing`;
      
      console.log('✅ Merchant synchronization completed');
      console.log(`📊 Results: ${results.message}`);
      
      return results;
    } catch (error: any) {
      const errorMsg = `Error in merchant processing: ${error.message || error}`;
      console.error('❌', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Get individual merchant details - Check database first, then API + save
   * Implements criterion 1.2: GET /merchants/{merchantId}
   */
  async getMerchantDetail(merchantId: string, accessToken: string, userId: string): Promise<{ 
    success: boolean; 
    merchant?: IFoodMerchant; 
    error?: string;
    action?: 'found_in_db' | 'added_from_api';
  }> {
    try {
      console.log(`🔍 Checking merchant: ${merchantId} for user: ${userId}`);

      // Validate inputs
      if (!merchantId || typeof merchantId !== 'string' || !userId) {
        return {
          success: false,
          error: 'Invalid merchantId or userId provided'
        };
      }

      // STEP 1: Check if merchant already exists in database
      console.log('🗄️ Checking database first...');
      const existsInDb = await this.checkMerchantExists(merchantId);
      
      if (existsInDb) {
        // Merchant already exists - return that it exists without doing anything
        console.log(`✅ Merchant ${merchantId} already exists in database`);
        
        // Get existing merchant data from database
        const { data: existingMerchant, error: dbError } = await this.supabase
          .from('ifood_merchants')
          .select('*')
          .eq('merchant_id', merchantId)
          .eq('user_id', userId)
          .single();

        if (dbError || !existingMerchant) {
          return {
            success: false,
            error: 'Merchant exists but access denied or database error'
          };
        }

        return {
          success: true,
          merchant: {
            id: existingMerchant.merchant_id,
            name: existingMerchant.name,
            corporateName: existingMerchant.corporate_name,
            phone: existingMerchant.phone,
            description: existingMerchant.description,
            // Map other database fields as needed
            address: {
              street: existingMerchant.address_street,
              number: existingMerchant.address_number,
              complement: existingMerchant.address_complement,
              neighborhood: existingMerchant.address_neighborhood,
              city: existingMerchant.address_city,
              state: existingMerchant.address_state,
              zipCode: existingMerchant.address_zip_code,
              country: existingMerchant.address_country
            },
            status: existingMerchant.status,
            lastSyncAt: existingMerchant.last_sync_at
          },
          action: 'found_in_db'
        };
      }

      // STEP 2: Merchant doesn't exist - fetch from API and save to database
      console.log(`📡 Merchant not found in database, fetching from iFood API...`);

      // Use the individual merchant endpoint if available, otherwise fetch from list
      const individualUrl = `${this.IFOOD_MERCHANT_URL}/${merchantId}`;
      
      const headers = {
        'accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
        // Removed x-correlation-id to match exact iFood API requirements
      };

      let apiMerchant: IFoodMerchant | null = null;

      try {
        // Try individual endpoint first
        console.log(`📡 Making request to iFood API:`);
        console.log(`   URL: ${individualUrl}`);
        console.log(`   Headers:`, headers);
        console.log(`   Token length: ${accessToken.length}`);
        const response = await axios.get(individualUrl, { headers });
        
        if (response.status === 200) {
          apiMerchant = response.data as IFoodMerchant;
          console.log(`✅ Successfully fetched merchant from individual API: ${apiMerchant.name}`);
        }
      } catch (individualError: any) {
        console.log(`❌ Individual endpoint failed:`);
        console.log(`   Status: ${individualError.response?.status}`);
        console.log(`   Error: ${individualError.response?.statusText}`);
        console.log(`   Data:`, individualError.response?.data);
        console.log(`⚠️ Falling back to list endpoint...`);
        
        // Fallback: Fetch from list and filter
        const { success, merchants } = await this.fetchMerchantsFromIFood(accessToken);
        
        if (!success) {
          return {
            success: false,
            error: (merchants[0] as any).error || 'Failed to fetch merchants'
          };
        }

        // Filter for specific merchant
        const merchantList = merchants as IFoodMerchant[];
        const targetMerchant = merchantList.find(m => m.id === merchantId);
        
        if (!targetMerchant) {
          console.log(`❌ Merchant ${merchantId} not found in API`);
          return {
            success: false,
            error: `Merchant with ID ${merchantId} not found in iFood`
          };
        }

        apiMerchant = targetMerchant;
        console.log(`✅ Found merchant in list: ${apiMerchant.name}`);
      }

      if (!apiMerchant) {
        return {
          success: false,
          error: 'Unable to fetch merchant details from iFood API'
        };
      }

      // STEP 3: Save the new merchant to database
      console.log(`💾 Saving new merchant ${merchantId} to database...`);
      
      // Get client_id for this user
      const tokenData = await this.getTokenFromDb(userId);
      const clientId = tokenData?.client_id;

      if (!clientId) {
        return {
          success: false,
          error: 'Could not determine client_id for saving merchant'
        };
      }

      // DEBUG: Log the full API response to understand the structure
      console.log('🔍 [DEBUG] getMerchantDetail - Full API merchant data:', JSON.stringify(apiMerchant, null, 2));

      // Map API data to database structure with all available fields
      const merchantForDb: MerchantData = {
        // Core fields (required)
        merchant_id: apiMerchant.id,
        name: apiMerchant.name,
        corporate_name: apiMerchant.corporateName || '',
        user_id: userId,
        client_id: clientId,
        status: true, // Default to available
        
        // Extended fields (optional)
        phone: apiMerchant.phone || null,
        description: apiMerchant.description || null,
        
        // Address fields - handle different API response structures
        address_street: apiMerchant.address?.street || apiMerchant.streetName || null,
        address_number: apiMerchant.address?.number || apiMerchant.streetNumber || null,
        address_complement: apiMerchant.address?.complement || apiMerchant.complement || null,
        address_neighborhood: apiMerchant.address?.neighborhood || apiMerchant.district || null,
        address_city: apiMerchant.address?.city || apiMerchant.city || null,
        address_state: apiMerchant.address?.state || apiMerchant.state || null,
        postalCode: apiMerchant.address?.zipCode || apiMerchant.zipCode || apiMerchant.postalCode || apiMerchant.address?.postalCode || null,
        address_country: apiMerchant.address?.country || apiMerchant.country || 'BR',
        
        // Business fields
        operating_hours: apiMerchant.operatingHours || apiMerchant.openingHours || null,
        type: (() => {
          const typeData = apiMerchant.type || apiMerchant.categories;
          if (!typeData) return undefined;
          // If it's already an array, use it; if it's a string, convert to array
          return Array.isArray(typeData) ? typeData : [typeData];
        })(),
        
        // Location fields - Enhanced mapping with multiple fallbacks
        latitude: (() => {
          // Try multiple possible field names and convert to string for numeric column
          const latValue = apiMerchant.latitude || 
                          apiMerchant.lat || 
                          apiMerchant.coordinates?.latitude || 
                          apiMerchant.location?.latitude ||
                          apiMerchant.address?.latitude ||
                          apiMerchant.geoLocation?.latitude;
          
          console.log('📍 [DEBUG] getMerchantDetail - Latitude value found:', latValue, 'type:', typeof latValue);
          return latValue ? String(latValue) : null;
        })(),
        longitude: (() => {
          // Try multiple possible field names and convert to string for numeric column
          const lngValue = apiMerchant.longitude || 
                          apiMerchant.lng || 
                          apiMerchant.coordinates?.longitude || 
                          apiMerchant.location?.longitude ||
                          apiMerchant.address?.longitude ||
                          apiMerchant.geoLocation?.longitude;
          
          console.log('📍 [DEBUG] getMerchantDetail - Longitude value found:', lngValue, 'type:', typeof lngValue);
          return lngValue ? String(lngValue) : null;
        })(),
        
        // Sync timestamp
        last_sync_at: new Date().toISOString()
      };

      console.log('💾 [DEBUG] getMerchantDetail - Final merchantForDb latitude/longitude:', {
        latitude: merchantForDb.latitude,
        longitude: merchantForDb.longitude
      });

      // Save to database
      const { success: saved, response } = await this.storeMerchant(merchantForDb);
      
      if (!saved) {
        console.error(`❌ Failed to save merchant to database: ${response.error}`);
        // Still return the API data even if save failed
        return {
          success: true,
          merchant: apiMerchant,
          action: 'added_from_api',
          error: `Warning: Merchant found in API but failed to save to database: ${response.error}`
        };
      }

      console.log(`✅ Merchant ${merchantId} successfully added to database`);
      
      return {
        success: true,
        merchant: apiMerchant,
        action: 'added_from_api'
      };

    } catch (error: any) {
      let errorMsg = 'Error processing merchant details';
      
      if (error.response) {
        errorMsg = `iFood API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
      } else if (error.request) {
        errorMsg = 'Network error: Unable to reach iFood API';
      } else {
        errorMsg = error.message || 'Unknown error processing merchant details';
      }

      console.error(`❌ Error processing merchant ${merchantId}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Bulk sync all merchants for a user - Enhanced synchronization
   * Gets all merchant_ids from database and refreshes their data from iFood API
   */
  async syncAllMerchantsForUser(userId: string): Promise<{
    success: boolean;
    total_processed: number;
    updated_merchants: string[];
    failed_merchants: Array<{ merchant_id: string; error: string }>;
    message?: string;
    error?: string;
  }> {
    try {
      console.log(`🔄 Starting bulk sync for all merchants of user: ${userId}`);

      // Step 1: Get access token
      const tokenData = await this.getTokenFromDb(userId);
      if (!tokenData || !tokenData.access_token) {
        return {
          success: false,
          total_processed: 0,
          updated_merchants: [],
          failed_merchants: [],
          error: 'No valid access token found for user'
        };
      }

      // Step 2: Get all merchant IDs for this user
      const { success: gotIds, merchant_ids, error: idsError } = await this.getUserMerchantIds(userId);
      
      if (!gotIds || !merchant_ids || merchant_ids.length === 0) {
        return {
          success: false,
          total_processed: 0,
          updated_merchants: [],
          failed_merchants: [],
          error: idsError || 'No merchants found for user'
        };
      }

      console.log(`📋 Found ${merchant_ids.length} merchants to sync for user ${userId}`);

      // Step 3: Process each merchant individually
      const results = {
        success: true,
        total_processed: merchant_ids.length,
        updated_merchants: [] as string[],
        failed_merchants: [] as Array<{ merchant_id: string; error: string }>,
        message: ''
      };

      for (const merchantId of merchant_ids) {
        try {
          console.log(`🔍 Processing merchant: ${merchantId}`);

          // Use the same logic as getMerchantDetail but force API refresh
          const refreshResult = await this.refreshMerchantFromAPI(merchantId, tokenData.access_token, userId);
          
          if (refreshResult.success) {
            results.updated_merchants.push(merchantId);
            console.log(`✅ Successfully refreshed merchant: ${merchantId}`);
          } else {
            results.failed_merchants.push({
              merchant_id: merchantId,
              error: refreshResult.error || 'Unknown error'
            });
            console.log(`❌ Failed to refresh merchant ${merchantId}: ${refreshResult.error}`);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          console.error(`❌ Error processing merchant ${merchantId}:`, error);
          results.failed_merchants.push({
            merchant_id: merchantId,
            error: error.message || 'Unknown processing error'
          });
        }
      }

      // Step 4: Generate summary
      const successCount = results.updated_merchants.length;
      const failureCount = results.failed_merchants.length;
      
      results.message = `Processed ${results.total_processed} merchants: ${successCount} updated successfully, ${failureCount} failed`;
      
      console.log(`✅ Bulk sync completed for user ${userId}`);
      console.log(`📊 Results: ${results.message}`);

      return results;

    } catch (error: any) {
      const errorMsg = `Error in bulk merchant sync: ${error.message || error}`;
      console.error('❌', errorMsg);
      return {
        success: false,
        total_processed: 0,
        updated_merchants: [],
        failed_merchants: [],
        error: errorMsg
      };
    }
  }

  /**
   * Refresh a single merchant from API and update database
   * Similar to getMerchantDetail but always fetches from API and updates DB
   */
  async refreshMerchantFromAPI(merchantId: string, accessToken: string, userId: string): Promise<{
    success: boolean;
    merchant?: IFoodMerchant;
    error?: string;
    action?: 'updated' | 'no_changes';
  }> {
    try {
      console.log(`🔄 Refreshing merchant ${merchantId} from API...`);

      // Step 1: Fetch fresh data from iFood API
      const individualUrl = `${this.IFOOD_MERCHANT_URL}/${merchantId}`;
      
      const headers = {
        'accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };

      let apiMerchant: IFoodMerchant | null = null;

      try {
        // Try individual endpoint first
        const response = await axios.get(individualUrl, { headers });
        
        if (response.status === 200) {
          apiMerchant = response.data as IFoodMerchant;
          console.log(`✅ Fetched fresh data for merchant: ${apiMerchant.name}`);
        }
      } catch (individualError: any) {
        console.log(`⚠️ Individual endpoint failed, trying list endpoint...`);
        
        // Fallback: Fetch from list and filter
        const { success, merchants } = await this.fetchMerchantsFromIFood(accessToken);
        
        if (!success) {
          return {
            success: false,
            error: (merchants[0] as any).error || 'Failed to fetch merchants from API'
          };
        }

        const merchantList = merchants as IFoodMerchant[];
        const targetMerchant = merchantList.find(m => m.id === merchantId);
        
        if (!targetMerchant) {
          return {
            success: false,
            error: `Merchant ${merchantId} not found in iFood API`
          };
        }

        apiMerchant = targetMerchant;
      }

      if (!apiMerchant) {
        return {
          success: false,
          error: 'Unable to fetch merchant data from iFood API'
        };
      }

      // Step 2: Get client_id for this user
      const tokenData = await this.getTokenFromDb(userId);
      const clientId = tokenData?.client_id;

      if (!clientId) {
        return {
          success: false,
          error: 'Could not determine client_id for user'
        };
      }

      // DEBUG: Log the full API response to understand the structure
      console.log('🔍 [DEBUG] Full API merchant data:', JSON.stringify(apiMerchant, null, 2));
      console.log('📍 [DEBUG] Location data analysis:');
      console.log('  - apiMerchant.latitude:', apiMerchant.latitude);
      console.log('  - apiMerchant.longitude:', apiMerchant.longitude);
      console.log('  - apiMerchant.lat:', apiMerchant.lat);
      console.log('  - apiMerchant.lng:', apiMerchant.lng);
      console.log('  - apiMerchant.coordinates:', apiMerchant.coordinates);
      console.log('  - apiMerchant.location:', apiMerchant.location);
      console.log('  - apiMerchant.address:', apiMerchant.address);
      console.log('📮 [DEBUG] PostalCode data analysis:');
      console.log('  - apiMerchant.postalCode:', apiMerchant.postalCode);
      console.log('  - apiMerchant.zipCode:', apiMerchant.zipCode);
      console.log('  - apiMerchant.address?.postalCode:', apiMerchant.address?.postalCode);
      console.log('  - apiMerchant.address?.zipCode:', apiMerchant.address?.zipCode);

      // Step 3: Update the merchant in database with fresh API data
      const merchantForDb: MerchantData = {
        // Core fields (required)
        merchant_id: apiMerchant.id,
        name: apiMerchant.name,
        corporate_name: apiMerchant.corporateName || '',
        user_id: userId,
        client_id: clientId,
        status: true,
        
        // Extended fields (optional)
        phone: apiMerchant.phone || null,
        description: apiMerchant.description || null,
        
        // Address fields
        address_street: apiMerchant.address?.street || apiMerchant.streetName || null,
        address_number: apiMerchant.address?.number || apiMerchant.streetNumber || null,
        address_complement: apiMerchant.address?.complement || apiMerchant.complement || null,
        address_neighborhood: apiMerchant.address?.neighborhood || apiMerchant.district || null,
        address_city: apiMerchant.address?.city || apiMerchant.city || null,
        address_state: apiMerchant.address?.state || apiMerchant.state || null,
        postalCode: apiMerchant.address?.zipCode || apiMerchant.zipCode || apiMerchant.postalCode || apiMerchant.address?.postalCode || null,
        address_country: apiMerchant.address?.country || apiMerchant.country || 'BR',
        
        // Business fields
        operating_hours: apiMerchant.operatingHours || apiMerchant.openingHours || null,
        type: (() => {
          const typeData = apiMerchant.type || apiMerchant.categories;
          if (!typeData) return undefined;
          return Array.isArray(typeData) ? typeData : [typeData];
        })(),
        
        // Location fields - Enhanced mapping with multiple fallbacks
        latitude: (() => {
          // Try multiple possible field names and convert to string for numeric column
          const latValue = apiMerchant.latitude || 
                          apiMerchant.lat || 
                          apiMerchant.coordinates?.latitude || 
                          apiMerchant.location?.latitude ||
                          apiMerchant.address?.latitude ||
                          apiMerchant.geoLocation?.latitude;
          
          console.log('📍 [DEBUG] Latitude value found:', latValue, 'type:', typeof latValue);
          return latValue ? String(latValue) : null;
        })(),
        longitude: (() => {
          // Try multiple possible field names and convert to string for numeric column
          const lngValue = apiMerchant.longitude || 
                          apiMerchant.lng || 
                          apiMerchant.coordinates?.longitude || 
                          apiMerchant.location?.longitude ||
                          apiMerchant.address?.longitude ||
                          apiMerchant.geoLocation?.longitude;
          
          console.log('📍 [DEBUG] Longitude value found:', lngValue, 'type:', typeof lngValue);
          return lngValue ? String(lngValue) : null;
        })(),
        
        // Update sync timestamp
        last_sync_at: new Date().toISOString()
      };

      console.log('💾 [DEBUG] Final merchantForDb latitude/longitude:', {
        latitude: merchantForDb.latitude,
        longitude: merchantForDb.longitude
      });

      // Step 4: Update in database (upsert)
      const { data, error } = await this.supabase
        .from('ifood_merchants')
        .upsert(merchantForDb, {
          onConflict: 'merchant_id,user_id'
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Failed to update merchant ${merchantId}:`, error);
        return {
          success: false,
          error: `Database update failed: ${error.message}`
        };
      }

      console.log(`✅ Successfully updated merchant ${merchantId} in database`);
      
      return {
        success: true,
        merchant: apiMerchant,
        action: 'updated'
      };

    } catch (error: any) {
      let errorMsg = 'Error refreshing merchant from API';
      
      if (error.response) {
        errorMsg = `iFood API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
      } else if (error.request) {
        errorMsg = 'Network error: Unable to reach iFood API';
      } else {
        errorMsg = error.message || 'Unknown error refreshing merchant';
      }

      console.error(`❌ Error refreshing merchant ${merchantId}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Validate if user has access to specific merchant
   * Security check for merchant ownership
   */
  async validateMerchantOwnership(merchantId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('ifood_merchants')
        .select('merchant_id, user_id')
        .eq('merchant_id', merchantId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        console.log(`🚫 Access denied: Merchant ${merchantId} not owned by user ${userId}`);
        return false;
      }

      console.log(`✅ Access validated: User ${userId} owns merchant ${merchantId}`);
      return true;
    } catch (error) {
      console.error('❌ Error validating merchant ownership:', error);
      return false;
    }
  }
}