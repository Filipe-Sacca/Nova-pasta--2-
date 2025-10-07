import { API_BASE_URL } from '../config/api';

// Service URLs
const LOCAL_SERVICE_URL = API_BASE_URL;

interface OpeningHours {
  id: string;
  dayOfWeek: string;
  start: string;
  duration: number;
}

interface OpeningHoursResponse {
  success: boolean;
  message?: string;
  data?: OpeningHours[];
  error?: string;
}

interface UpdateOpeningHoursRequest {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

interface UpdateOpeningHoursResponse {
  success: boolean;
  message?: string;
  data?: {
    merchantId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  };
  error?: string;
}

/**
 * Check if local service is available
 */
async function checkLocalService(): Promise<boolean> {
  try {
    const response = await fetch(`${LOCAL_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (error) {
    console.log('❌ Local service not available');
    return false;
  }
}

/**
 * Fetch opening hours from iFood API via backend REST
 * This gets fresh data directly from iFood, not from Supabase cache
 */
export async function getOpeningHours(merchantId: string): Promise<OpeningHoursResponse> {
  try {
    console.log('🕐 [OPENING HOURS SERVICE] Fetching from iFood API for merchant:', merchantId);

    // Check if local service is available
    const isLocalAvailable = await checkLocalService();
    if (!isLocalAvailable) {
      throw new Error('Local service is not available. Please ensure the iFood Token Service is running on port 8093.');
    }

    const response = await fetch(`${LOCAL_SERVICE_URL}/merchants/${merchantId}/opening-hours`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch opening hours');
    }

    console.log('🕐 [OPENING HOURS SERVICE] Success:', data.data?.length || 0, 'hours fetched');

    return {
      success: true,
      message: data.message,
      data: data.data || []
    };

  } catch (error: any) {
    console.error('❌ [OPENING HOURS SERVICE] Error fetching opening hours:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch opening hours'
    };
  }
}

/**
 * Update opening hours via backend REST (already in use)
 */
export async function updateOpeningHours(
  merchantId: string,
  updateData: UpdateOpeningHoursRequest
): Promise<UpdateOpeningHoursResponse> {
  try {
    console.log('🕐 [OPENING HOURS SERVICE] Updating hours for merchant:', merchantId, updateData);

    // Check if local service is available
    const isLocalAvailable = await checkLocalService();
    if (!isLocalAvailable) {
      throw new Error('Local service is not available. Please ensure the iFood Token Service is running on port 8093.');
    }

    const response = await fetch(`${LOCAL_SERVICE_URL}/merchants/${merchantId}/opening-hours`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update opening hours');
    }

    console.log('🕐 [OPENING HOURS SERVICE] Update success:', data.message);

    return {
      success: true,
      message: data.message,
      data: data.data
    };

  } catch (error: any) {
    console.error('❌ [OPENING HOURS SERVICE] Error updating opening hours:', error);
    return {
      success: false,
      error: error.message || 'Failed to update opening hours'
    };
  }
}

/**
 * Fetch and save opening hours automatically (for integration with getMerchantDetail)
 */
export async function fetchAndSaveOpeningHours(merchantId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    console.log('🔄 [AUTO-SYNC] Fetching and saving opening hours for merchant:', merchantId);

    // 1. Fetch from iFood API
    const result = await getOpeningHours(merchantId);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch opening hours from iFood'
      };
    }

    // 2. Here we could add logic to save to Supabase if needed
    // For now, we'll just return the fetched data
    console.log('✅ [AUTO-SYNC] Opening hours fetched successfully:', result.data.length, 'entries');

    return {
      success: true,
      message: `Successfully fetched ${result.data.length} opening hours entries`
    };

  } catch (error: any) {
    console.error('❌ [AUTO-SYNC] Error in fetchAndSaveOpeningHours:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch and save opening hours'
    };
  }
}