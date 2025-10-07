import { supabase } from '../integrations/supabase/client';
import { API_BASE_URL } from '../config/api';

// Service URLs
const LOCAL_SERVICE_URL = API_BASE_URL;

interface MerchantSyncResult {
  success: boolean;
  total_merchants?: number;
  new_merchants?: string[];
  existing_merchants?: string[];
  errors?: Array<{ merchant_id: string; error: string }>;
  message?: string;
  error?: string;
}

/**
 * Check if local service is available
 */
async function checkLocalService(): Promise<boolean> {
  try {
    const response = await fetch(`${LOCAL_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.log('❌ Local service not available');
    return false;
  }
}

/**
 * Sync merchants with local service
 */
async function syncMerchantsLocal(userId: string, accessToken?: string): Promise<MerchantSyncResult> {
  try {
    console.log('🏪 Syncing merchants via local service...');
    
    const response = await fetch(`${LOCAL_SERVICE_URL}/merchant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        access_token: accessToken
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to sync merchants');
    }

    return data;
  } catch (error: any) {
    console.error('❌ Local service error:', error);
    throw error;
  }
}


/**
 * Main function to sync merchants using local service only
 */
export async function syncMerchants(userId: string, accessToken?: string): Promise<MerchantSyncResult> {
  try {
    // Check if we have a user ID
    if (!userId) {
      throw new Error('User ID is required');
    }

    // If no access token provided, try to get it from the database
    if (!accessToken) {
      console.log('🔍 No access token provided, fetching from database...');
      
      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token')
        .eq('user_id', userId)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('No valid token found for user. Please generate a token first.');
      }

      accessToken = tokenData.access_token;
    }

    // Check if local service is available
    const isLocalAvailable = await checkLocalService();

    if (!isLocalAvailable) {
      throw new Error('Local service is not available. Please ensure the iFood Token Service is running on port 8085.');
    }

    // Use local service only
    return await syncMerchantsLocal(userId, accessToken);
  } catch (error: any) {
    console.error('❌ Merchant sync failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync merchants'
    };
  }
}

/**
 * Check if a specific merchant exists
 */
export async function checkMerchantExists(merchantId: string): Promise<boolean> {
  try {
    // Try local service first
    const isLocalAvailable = await checkLocalService();
    
    if (isLocalAvailable) {
      const response = await fetch(`${LOCAL_SERVICE_URL}/merchant/check/${merchantId}`);
      if (response.ok) {
        const data = await response.json();
        return data.exists;
      }
    }

    // Fallback to direct database query
    const { data, error } = await supabase
      .from('ifood_merchants')
      .select('merchant_id')
      .eq('merchant_id', merchantId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error checking merchant:', error);
    return false;
  }
}

/**
 * Get all merchants for a user
 */
export async function getUserMerchants(userId: string) {
  try {
    const { data, error } = await supabase
      .from('ifood_merchants')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching merchants:', error);
    return [];
  }
}

/**
 * Sync all merchants for a user - Enhanced bulk synchronization
 * Gets all merchant_ids from database and refreshes their data from iFood API
 */
export async function syncAllMerchants(userId: string): Promise<{
  success: boolean;
  total_processed: number;
  updated_merchants: string[];
  failed_merchants: Array<{ merchant_id: string; error: string }>;
  message?: string;
  error?: string;
}> {
  try {
    console.log(`🔄 Starting bulk merchant sync for user: ${userId}`);

    // Validate inputs
    if (!userId) {
      return {
        success: false,
        total_processed: 0,
        updated_merchants: [],
        failed_merchants: [],
        error: 'User ID is required'
      };
    }

    // Check if local service is available
    const isLocalAvailable = await checkLocalService();
    if (!isLocalAvailable) {
      return {
        success: false,
        total_processed: 0,
        updated_merchants: [],
        failed_merchants: [],
        error: 'Local service is not available. Please ensure the iFood Token Service is running on port 8085.'
      };
    }

    // Call the new bulk sync endpoint
    const response = await fetch(`${LOCAL_SERVICE_URL}/merchants/sync-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        total_processed: 0,
        updated_merchants: [],
        failed_merchants: [],
        error: data.error || 'Failed to sync all merchants'
      };
    }

    console.log(`✅ Bulk sync completed: ${data.message}`);
    return data;

  } catch (error: any) {
    console.error('❌ Error in bulk merchant sync:', error);
    return {
      success: false,
      total_processed: 0,
      updated_merchants: [],
      failed_merchants: [],
      error: error.message || 'Network error during bulk sync'
    };
  }
}

/**
 * Get individual merchant details - Database first, then API + save
 * Implements the user's desired logic:
 * 1. Check database first - if exists, return "already exists"
 * 2. If not exists, fetch from API and save to database
 */
export async function getMerchantDetail(merchantId: string, userId: string): Promise<{
  success: boolean;
  merchant?: any;
  error?: string;
  action?: 'found_in_db' | 'added_from_api';
}> {
  try {
    console.log(`🔍 Checking merchant: ${merchantId} for user: ${userId}`);

    // Validate inputs
    if (!merchantId || !userId) {
      return {
        success: false,
        error: 'merchantId and userId are required'
      };
    }

    // STEP 1: Check database first - if exists, don't do anything else
    console.log('🗄️ Checking if merchant already exists in database...');
    console.log(`🔍 Query params: merchant_id=${merchantId}, user_id=${userId}`);
    
    const { data: dbMerchant, error: dbError } = await supabase
      .from('ifood_merchants')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle instead of single to handle "not found" gracefully
    
    console.log('📊 Database query result:', { 
      found: !!dbMerchant, 
      error: dbError?.message || 'none',
      errorCode: dbError?.code || 'none'
    });

    if (dbMerchant && !dbError) {
      // Merchant already exists - just return it, don't do anything else
      console.log(`✅ Merchant ${merchantId} already exists in database - no action needed`);
      
      return {
        success: true,
        merchant: {
          id: dbMerchant.merchant_id,
          name: dbMerchant.name,
          corporateName: dbMerchant.corporate_name,
          phone: dbMerchant.phone,
          description: dbMerchant.description,
          address: {
            street: dbMerchant.address_street,
            number: dbMerchant.address_number,
            complement: dbMerchant.address_complement,
            neighborhood: dbMerchant.address_neighborhood,
            city: dbMerchant.address_city,
            state: dbMerchant.address_state,
            zipCode: dbMerchant.address_zip_code,
            country: dbMerchant.address_country
          },
          status: dbMerchant.status,
          lastSyncAt: dbMerchant.last_sync_at
        },
        action: 'found_in_db'
      };
    }

    // STEP 2: Merchant doesn't exist - fetch from API and save to database
    console.log(`📡 Merchant not found in database, will fetch from API and save...`);
    
    // Check if local service is available (needed for API call)
    const isLocalAvailable = await checkLocalService();
    if (!isLocalAvailable) {
      return {
        success: false,
        error: 'Merchant não encontrado no banco e serviço backend (porta 8085) não está disponível. Inicie o backend para buscar novos merchants na API iFood.'
      };
    }

    // Call the backend endpoint that will fetch from API and save to database
    // Backend will use any available token from database
    const response = await fetch(`${LOCAL_SERVICE_URL}/merchants/${merchantId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const statusCode = response.status;
      let errorMessage = data.error || 'Failed to fetch merchant details';
      
      // Map status codes to user-friendly messages
      switch (statusCode) {
        case 400:
          errorMessage = 'Parâmetros inválidos';
          break;
        case 401:
          errorMessage = 'Token de acesso não encontrado. Faça login no iFood primeiro.';
          break;
        case 403:
          errorMessage = 'Acesso negado. Você não tem permissão para acessar esta loja.';
          break;
        case 404:
          errorMessage = 'Loja não encontrada no iFood.';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor.';
          break;
      }

      return {
        success: false,
        error: errorMessage
      };
    }

    console.log(`✅ Successfully fetched and saved merchant: ${data.merchant?.name}`);

    // 🕐 AUTO-FETCH OPENING HOURS: Buscar horários automaticamente após salvar merchant
    try {
      console.log('🕐 [AUTO-SYNC] Buscando horários de funcionamento automaticamente...');

      const openingHoursResponse = await fetch(`${LOCAL_SERVICE_URL}/merchants/${merchantId}/opening-hours`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (openingHoursResponse.ok) {
        const openingHoursData = await openingHoursResponse.json();
        console.log('✅ [AUTO-SYNC] Horários de funcionamento sincronizados com sucesso:', openingHoursData.data?.length || 0, 'horários');
      } else {
        console.log('⚠️ [AUTO-SYNC] Falha ao sincronizar horários, mas merchant foi salvo com sucesso');
      }
    } catch (openingHoursError) {
      console.log('⚠️ [AUTO-SYNC] Erro ao buscar horários, mas merchant foi salvo:', openingHoursError);
    }

    return {
      success: true,
      merchant: data.merchant,
      action: 'added_from_api'
    };

  } catch (error: any) {
    console.error('❌ Error processing merchant details:', error);
    return {
      success: false,
      error: error.message || 'Network error while processing merchant details'
    };
  }
}