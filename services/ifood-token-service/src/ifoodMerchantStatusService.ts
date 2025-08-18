/**
 * iFood Merchant Status Service
 * Converts N8N workflow [MERCHANT-STATUS] to TypeScript code
 * Checks if stores are open and updates their status in the database
 */

import axios from 'axios';
import { supabase, getTokenForUser } from './ifoodTokenService.js';
import * as schedule from 'node-schedule';

interface OpeningHours {
  id?: string;
  dayOfWeek: string;
  start: string; // HH:MM:SS
  end?: string;  // HH:MM:SS
  duration?: number; // minutes
}

interface MerchantStatus {
  merchantId: string;
  isOpen: boolean;
  statusMessage: string;
  currentTime: string;
  openingTime: string;
  closingTime: string;
}

interface Interruption {
  id?: string;
  startDate: string;  // ISO format
  endDate?: string;   // ISO format - optional for indefinite
  reason?: string;
  description?: string;
}

interface CreateInterruptionRequest {
  start: string;       // OBRIGATÓRIO - ISO format
  end: string;         // OBRIGATÓRIO - ISO format  
  description: string; // OBRIGATÓRIO
  reason?: string;     // Opcional
}

interface Merchant {
  id: string;
  merchant_id: string;
  user_id: string;
  name: string;
  status: boolean;
}

export class IFoodMerchantStatusService {
  private static IFOOD_STATUS_URL = 'https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchantId}/status';
  private static IFOOD_HOURS_URL = 'https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchantId}/opening-hours';
  private static IFOOD_INTERRUPTIONS_URL = 'https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchantId}/interruptions';
  
  // Day mapping
  private static DAY_MAP: { [key: string]: number } = {
    'MONDAY': 1,
    'TUESDAY': 2,
    'WEDNESDAY': 3,
    'THURSDAY': 4,
    'FRIDAY': 5,
    'SATURDAY': 6,
    'SUNDAY': 0
  };

  /**
   * Get all merchants from database
   */
  static async getAllMerchants(): Promise<Merchant[]> {
    try {
      const { data, error } = await supabase
        .from('ifood_merchants')
        .select('*');

      if (error) {
        console.error('Error fetching merchants:', error);
        return [];
      }

      console.log(`Found ${data?.length || 0} merchants in database`);
      return data || [];
    } catch (error) {
      console.error('Error fetching merchants:', error);
      return [];
    }
  }

  /**
   * Fetch merchant status from iFood API
   */
  static async fetchMerchantStatus(
    merchantId: string,
    accessToken: string
  ): Promise<{ success: boolean; data: any }> {
    try {
      const response = await axios.get(
        this.IFOOD_STATUS_URL.replace('{merchantId}', merchantId),
        {
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(`Error fetching merchant status: ${error.message}`);
      return { success: false, data: { error: error.message } };
    }
  }

  /**
   * Fetch opening hours from iFood API
   */
  static async fetchOpeningHours(
    merchantId: string,
    accessToken: string
  ): Promise<{ success: boolean; hours: OpeningHours[] }> {
    try {
      const response = await axios.get(
        this.IFOOD_HOURS_URL.replace('{merchantId}', merchantId),
        {
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const data = response.data;
      let hours: OpeningHours[] = [];

      // Extract shifts/periods from response
      if (data.shifts) {
        hours = data.shifts;
      } else if (data.periods) {
        hours = data.periods;
      } else if (Array.isArray(data)) {
        hours = data;
      } else {
        console.warn(`Unknown opening hours format: ${Object.keys(data)}`);
      }

      return { success: true, hours };
    } catch (error: any) {
      console.error(`Error fetching opening hours: ${error.message}`);
      return { success: false, hours: [] };
    }
  }

  /**
   * Parse time string to Date object
   */
  private static parseTime(timeStr: string): Date {
    const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, seconds, 0);
    return date;
  }

  /**
   * Add minutes to a time string
   */
  private static addMinutesToTime(startTime: string, durationMinutes: number): string {
    const start = this.parseTime(startTime);
    const endTime = new Date(start.getTime() + durationMinutes * 60000);
    return `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}:${String(endTime.getSeconds()).padStart(2, '0')}`;
  }

  /**
   * Calculate if merchant is currently open based on opening hours
   * Also returns if we're within business hours
   */
  static calculateIfOpen(openingHours: OpeningHours[]): MerchantStatus & { withinBusinessHours: boolean } {
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Find today's schedule
    let todaySchedule: OpeningHours | undefined;
    for (const period of openingHours) {
      const dayOfWeek = period.dayOfWeek;
      if (this.DAY_MAP[dayOfWeek] === currentDay) {
        todaySchedule = period;
        break;
      }
    }

    if (!todaySchedule) {
      return {
        merchantId: '',
        isOpen: false,
        statusMessage: 'Não há funcionamento hoje',
        currentTime,
        openingTime: '',
        closingTime: '',
        withinBusinessHours: false
      };
    }

    // Calculate opening and closing times
    const startTime = todaySchedule.start || '00:00:00';
    const duration = todaySchedule.duration || 0;
    const endTime = todaySchedule.end || this.addMinutesToTime(startTime, duration);

    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    const current = this.parseTime(currentTime);

    // Check if currently within business hours
    let withinBusinessHours = false;
    let isOpen = false;
    let statusMessage = '';

    if (start <= end) {
      // Normal hours (doesn't cross midnight)
      withinBusinessHours = current >= start && current <= end;
      isOpen = withinBusinessHours; // For now, assuming iFood status matches business hours
      
      if (withinBusinessHours) {
        statusMessage = `Dentro do horário de funcionamento (até ${endTime})`;
      } else if (current < start) {
        statusMessage = `Fora do horário - Abrirá às ${startTime}`;
      } else {
        statusMessage = `Fora do horário - Fechou às ${endTime}`;
      }
    } else {
      // Crosses midnight
      withinBusinessHours = current >= start || current <= end;
      isOpen = withinBusinessHours;
      
      if (withinBusinessHours) {
        statusMessage = `Dentro do horário de funcionamento (até ${endTime})`;
      } else {
        statusMessage = `Fora do horário - Abrirá às ${startTime}`;
      }
    }

    return {
      merchantId: '',
      isOpen,
      statusMessage,
      currentTime,
      openingTime: startTime,
      closingTime: endTime,
      withinBusinessHours
    };
  }

  /**
   * Update merchant status in database
   */
  static async updateMerchantStatus(
    merchantId: string,
    isOpen: boolean
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ifood_merchants')
        .update({ status: isOpen })
        .eq('merchant_id', merchantId);

      if (error) {
        console.error(`Failed to update status: ${error.message}`);
        return false;
      }

      console.log(`Updated merchant ${merchantId} status to ${isOpen}`);
      return true;
    } catch (error: any) {
      console.error(`Error updating merchant status: ${error.message}`);
      return false;
    }
  }

  /**
   * Save opening hours to database for a specific merchant
   */
  static async saveOpeningHoursToDatabase(
    merchantId: string, 
    shifts: OpeningHours[]
  ): Promise<boolean> {
    try {
      // Create day mapping for quick access in future PUT operations
      const byDay: { [key: string]: string } = {};
      shifts.forEach(shift => {
        if (shift.id) {
          byDay[shift.dayOfWeek] = shift.id;
        }
      });

      const operatingHours = {
        shifts: shifts,
        by_day: byDay,
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('ifood_merchants')
        .update({ operating_hours: operatingHours })
        .eq('merchant_id', merchantId);

      if (error) {
        console.error(`Failed to save opening hours for ${merchantId}: ${error.message}`);
        return false;
      }

      console.log(`✅ Saved opening hours for merchant ${merchantId}`);
      return true;
    } catch (error: any) {
      console.error(`Error saving opening hours: ${error.message}`);
      return false;
    }
  }

  /**
   * Update opening hours for a specific merchant and day
   */
  static async updateOpeningHours(
    merchantId: string,
    dayOfWeek: string,      // "MONDAY", "TUESDAY", etc
    startTime: string,      // "08:00:00"
    endTime: string,        // "18:00:00"
    accessToken: string
  ): Promise<{success: boolean; message: string}> {
    try {
      console.log(`🔄 Updating opening hours for ${merchantId} - ${dayOfWeek}: ${startTime} to ${endTime}`);

      // 1. Get stored opening hours with IDs from database
      const { data: merchant, error: merchantError } = await supabase
        .from('ifood_merchants')
        .select('operating_hours')
        .eq('merchant_id', merchantId)
        .single();

      if (merchantError || !merchant?.operating_hours?.by_day) {
        return {
          success: false,
          message: 'Merchant not found or no opening hours data available. Run polling first.'
        };
      }

      // 2. Get the specific day ID
      const dayId = merchant.operating_hours.by_day[dayOfWeek];
      if (!dayId) {
        return {
          success: false,
          message: `No ID found for ${dayOfWeek}. Available days: ${Object.keys(merchant.operating_hours.by_day).join(', ')}`
        };
      }

      // 3. Calculate duration in minutes
      const duration = this.calculateDuration(startTime, endTime);
      if (duration <= 0) {
        return {
          success: false,
          message: 'Invalid time range. End time must be after start time.'
        };
      }

      // 4. Prepare PUT request body
      const putBody = {
        shifts: [
          {
            id: dayId,
            dayOfWeek: dayOfWeek,
            start: startTime,
            duration: duration
          }
        ]
      };

      console.log(`📤 PUT body:`, JSON.stringify(putBody, null, 2));

      // 5. Make PUT request to iFood API
      const response = await axios.put(
        this.IFOOD_HOURS_URL.replace('{merchantId}', merchantId),
        putBody,
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      console.log(`✅ iFood API response: ${response.status}`);

      // 6. Update our database with new hours (will be updated in next polling cycle)
      // For now, just return success
      return {
        success: true,
        message: `Opening hours updated successfully for ${dayOfWeek}. Changes will be reflected in next polling cycle.`
      };

    } catch (error: any) {
      console.error(`❌ Error updating opening hours:`, error.response?.data || error.message);
      return {
        success: false,
        message: `Failed to update opening hours: ${error.response?.data?.message || error.message}`
      };
    }
  }

  /**
   * Calculate duration in minutes between start and end time
   */
  private static calculateDuration(startTime: string, endTime: string): number {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = (startHour * 60) + startMin;
    const endMinutes = (endHour * 60) + endMin;
    
    // Handle times that cross midnight
    let duration = endMinutes - startMinutes;
    if (duration < 0) {
      duration += (24 * 60); // Add 24 hours if crosses midnight
    }
    
    return duration;
  }

  /**
   * Create a scheduled pause (interruption) for a merchant
   */
  static async createScheduledPause(
    merchantId: string,
    startDate: string,      // ISO format: "2025-01-17T14:00:00Z" - OBRIGATÓRIO
    endDate: string,        // ISO format: "2025-01-17T18:00:00Z" - OBRIGATÓRIO
    description: string,    // Descrição - OBRIGATÓRIO 
    accessToken: string,    // OBRIGATÓRIO
    userId: string,         // OBRIGATÓRIO - para salvar na tabela local
    reason?: string         // Motivo da pausa - Opcional
  ): Promise<{success: boolean; message: string; interruptionId?: string}> {
    try {
      console.log(`🔄 Creating scheduled pause for merchant: ${merchantId}`);
      console.log(`📅 Start: ${startDate}, End: ${endDate || 'Indefinite'}`);

      // Convert frontend UTC dates to Brazilian timezone for iFood API
      const startUTC = new Date(startDate);
      const endUTC = new Date(endDate);
      
      // Subtract 3 hours to get Brazilian time for iFood API
      const startBrazil = new Date(startUTC.getTime() - 3 * 60 * 60 * 1000);
      const endBrazil = new Date(endUTC.getTime() - 3 * 60 * 60 * 1000);

      // Prepare request body (start, end, description are required)
      const requestBody: CreateInterruptionRequest = {
        start: startBrazil.toISOString(),
        end: endBrazil.toISOString(),
        description: description,
        ...(reason && { reason })
      };

      console.log(`📅 Adjusted for Brazil: Start: ${startBrazil.toISOString()}, End: ${endBrazil.toISOString()}`);

      console.log(`📤 POST body:`, JSON.stringify(requestBody, null, 2));

      // Make POST request to iFood API
      const response = await axios.post(
        this.IFOOD_INTERRUPTIONS_URL.replace('{merchantId}', merchantId),
        requestBody,
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      console.log(`✅ iFood API response: ${response.status}`);
      console.log(`📥 Response data:`, JSON.stringify(response.data, null, 2));

      // Extract interruption ID from response
      const interruptionId = response.data?.id || response.data?.interruptionId;

      // Save to local database using the same Brazilian timezone dates
      try {
        const { data: dbData, error: dbError } = await supabase
          .from('ifood_interruptions')
          .insert({
            user_id: userId,
            merchant_id: merchantId,
            ifood_interruption_id: interruptionId,
            start_date: startBrazil.toISOString(),
            end_date: endBrazil.toISOString(),
            description: description,
            reason: reason || null,
            is_active: true
          })
          .select();

        if (dbError) {
          console.error('❌ Error saving interruption to database:', dbError);
          // Continue even if local save fails
        } else {
          console.log('💾 Interruption saved to local database:', dbData?.[0]?.id);
        }
      } catch (localError: any) {
        console.error('❌ Local database error:', localError.message);
        // Continue even if local save fails
      }

      return {
        success: true,
        message: `Pausa programada criada com sucesso${endDate ? ` até ${new Date(endDate).toLocaleString('pt-BR')}` : ' (indefinida)'}`,
        interruptionId: interruptionId
      };

    } catch (error: any) {
      console.error(`❌ Error creating scheduled pause:`, error.response?.data || error.message);
      
      let errorMessage = 'Falha ao criar pausa programada';
      if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos para pausa programada';
      } else if (error.response?.status === 401) {
        errorMessage = 'Token de acesso inválido';
      } else if (error.response?.status === 409) {
        errorMessage = 'Já existe uma pausa ativa para este período';
      }

      return {
        success: false,
        message: `${errorMessage}: ${error.response?.data?.message || error.message}`
      };
    }
  }

  /**
   * List all interruptions for a merchant
   */
  static async listScheduledPauses(
    merchantId: string,
    userId: string
  ): Promise<{success: boolean; data: any[]; message?: string}> {
    try {
      console.log(`🔍 Listing scheduled pauses for merchant: ${merchantId}, user: ${userId}`);

      // Get pauses from local database
      const { data: localPauses, error: dbError } = await supabase
        .from('ifood_interruptions')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (dbError) {
        console.error('❌ Database error:', dbError);
        return {
          success: false,
          data: [],
          message: `Database error: ${dbError.message}`
        };
      }

      console.log(`💾 Found ${localPauses?.length || 0} scheduled pauses in local database`);

      // Transform data to match expected format
      const transformedData = (localPauses || []).map(pause => ({
        id: pause.ifood_interruption_id || pause.id,
        start_date: pause.start_date,
        end_date: pause.end_date,
        description: pause.description,
        reason: pause.reason,
        is_active: pause.is_active && new Date(pause.end_date) > new Date()
      }));

      return {
        success: true,
        data: transformedData
      };

    } catch (error: any) {
      console.error(`❌ Error listing scheduled pauses:`, error.message);
      return {
        success: false,
        data: [],
        message: `Failed to list scheduled pauses: ${error.message}`
      };
    }
  }

  /**
   * Remove a specific interruption
   */
  static async removeScheduledPause(
    merchantId: string,
    interruptionId: string,
    accessToken: string,
    userId: string
  ): Promise<{success: boolean; message: string}> {
    try {
      console.log(`🗑️ Removing scheduled pause: ${interruptionId} for merchant: ${merchantId}`);

      // First, try to remove from iFood API
      try {
        const response = await axios.delete(
          `${this.IFOOD_INTERRUPTIONS_URL.replace('{merchantId}', merchantId)}/${interruptionId}`,
          {
            headers: {
              'accept': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        console.log(`✅ Scheduled pause removed from iFood API: ${response.status}`);
      } catch (apiError: any) {
        console.warn(`⚠️ Failed to remove from iFood API (will still remove locally):`, apiError.response?.data || apiError.message);
      }

      // Remove from local database
      const { error: dbError } = await supabase
        .from('ifood_interruptions')
        .delete()
        .eq('merchant_id', merchantId)
        .eq('user_id', userId)
        .or(`ifood_interruption_id.eq.${interruptionId},id.eq.${interruptionId}`);

      if (dbError) {
        console.error('❌ Error removing from local database:', dbError);
        return {
          success: false,
          message: `Erro ao remover da base de dados local: ${dbError.message}`
        };
      }

      console.log(`💾 Scheduled pause removed from local database`);

      return {
        success: true,
        message: 'Pausa programada removida com sucesso'
      };

    } catch (error: any) {
      console.error(`❌ Error removing scheduled pause:`, error.response?.data || error.message);
      return {
        success: false,
        message: `Failed to remove scheduled pause: ${error.response?.data?.message || error.message}`
      };
    }
  }

  /**
   * Check status for a single merchant
   */
  static async checkSingleMerchantStatus(merchantId: string): Promise<MerchantStatus | null> {
    try {
      // Get merchant data
      const { data: merchants, error } = await supabase
        .from('ifood_merchants')
        .select('*')
        .eq('merchant_id', merchantId)
        .single();

      if (error || !merchants) {
        console.error('Merchant not found');
        return null;
      }

      const merchant = merchants as Merchant;

      // Get token
      const tokenData = await getTokenForUser(merchant.user_id);
      if (!tokenData || !tokenData.access_token) {
        console.error('No access token found');
        return null;
      }

      // Fetch opening hours
      const { success, hours } = await this.fetchOpeningHours(
        merchantId,
        tokenData.access_token
      );

      if (!success || hours.length === 0) {
        console.error('Could not fetch opening hours');
        return null;
      }

      // Calculate status
      const status = this.calculateIfOpen(hours);
      status.merchantId = merchantId;

      // Fetch actual iFood status
      const { success: statusSuccess, data: ifoodStatus } = await this.fetchMerchantStatus(
        merchantId,
        tokenData.access_token
      );

      const isActuallyOpen = statusSuccess && ifoodStatus?.state === 'OPEN';

      // Logic: Only update database if store is closed on iFood while within business hours
      if (status.withinBusinessHours && !isActuallyOpen) {
        // Store is closed on iFood during business hours - update database
        if (merchant.status !== false) {
          await this.updateMerchantStatus(merchantId, false);
          console.log(`⚠️ Merchant ${merchantId} is CLOSED during business hours`);
        }
      } else if (isActuallyOpen && !merchant.status) {
        // Store is open on iFood - update database if it was marked as closed
        await this.updateMerchantStatus(merchantId, true);
        console.log(`✅ Merchant ${merchantId} is OPEN - updating database`);
      }
      // If store is closed outside business hours or open during business hours - do nothing

      return status;
    } catch (error: any) {
      console.error(`Error checking merchant status: ${error.message}`);
      return null;
    }
  }

  /**
   * Main method to check all merchant statuses
   * Replicates the N8N workflow [MERCHANT-STATUS]:
   * 1. Get all merchants from database
   * 2. For each merchant:
   *    - Fetch opening hours from iFood
   *    - Calculate if currently open
   *    - Update status in database
   */
  static async checkAllMerchantStatuses(): Promise<{
    success: boolean;
    totalMerchants: number;
    checked: number;
    updated: number;
    errors: any[];
  }> {
    try {
      console.log('Starting merchant status check...');

      // Get all merchants
      const merchants = await this.getAllMerchants();
      if (!merchants || merchants.length === 0) {
        return {
          success: false,
          totalMerchants: 0,
          checked: 0,
          updated: 0,
          errors: [{ error: 'No merchants found' }]
        };
      }

      const results = {
        success: true,
        totalMerchants: merchants.length,
        checked: 0,
        updated: 0,
        errors: [] as any[]
      };

      // Process merchants in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < merchants.length; i += batchSize) {
        const batch = merchants.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (merchant) => {
            try {
              const merchantId = merchant.merchant_id;
              const userId = merchant.user_id;
              const currentStatus = merchant.status;

              // Skip if no merchant_id or user_id
              if (!merchantId || !userId) {
                return;
              }

              results.checked++;

              // Get token for this merchant's user
              const tokenData = await getTokenForUser(userId);
              if (!tokenData || !tokenData.access_token) {
                console.warn(`No token found for merchant ${merchantId}`);
                results.errors.push({
                  merchantId,
                  error: 'No access token'
                });
                return;
              }

              // Fetch opening hours
              console.log(`🔍 Fetching opening hours for merchant: ${merchantId}`);
              const { success, hours } = await this.fetchOpeningHours(
                merchantId,
                tokenData.access_token
              );

              console.log(`📊 Opening hours result - Success: ${success}, Hours count: ${hours.length}`);
              if (hours.length > 0) {
                console.log(`📋 First hour sample:`, JSON.stringify(hours[0], null, 2));
              }

              if (!success || hours.length === 0) {
                console.warn(`❌ Could not fetch opening hours for ${merchantId} - Success: ${success}, Hours: ${hours.length}`);
                return;
              }

              // Save opening hours to database
              await this.saveOpeningHoursToDatabase(merchantId, hours);

              // Calculate if within business hours
              const status = this.calculateIfOpen(hours);
              status.merchantId = merchantId;

              // Fetch actual iFood status
              const { success: statusSuccess, data: ifoodStatus } = await this.fetchMerchantStatus(
                merchantId,
                tokenData.access_token
              );

              const isActuallyOpen = statusSuccess && ifoodStatus?.state === 'OPEN';

              // Apply business logic:
              // 1. If store is CLOSED on iFood during business hours -> Update DB to closed
              // 2. If store is OPEN on iFood -> Update DB to open (if it was closed)
              // 3. If store is CLOSED outside business hours -> Do nothing
              
              if (status.withinBusinessHours && !isActuallyOpen) {
                // Store is closed during business hours - this is a problem!
                if (currentStatus !== false) {
                  if (await this.updateMerchantStatus(merchantId, false)) {
                    results.updated++;
                    console.log(`⚠️ Merchant ${merchantId}: FECHADO durante horário comercial - ${status.statusMessage}`);
                  }
                }
              } else if (isActuallyOpen) {
                // Store is open on iFood
                if (currentStatus !== true) {
                  if (await this.updateMerchantStatus(merchantId, true)) {
                    results.updated++;
                    console.log(`✅ Merchant ${merchantId}: ABERTO no iFood - ${status.statusMessage}`);
                  }
                }
              } else if (!status.withinBusinessHours && !isActuallyOpen) {
                // Store is closed outside business hours - this is expected
                console.log(`💤 Merchant ${merchantId}: Fechado fora do horário - ${status.statusMessage}`);
              }
            } catch (error: any) {
              console.error(`Error processing merchant ${merchant.merchant_id}: ${error.message}`);
              results.errors.push({
                merchantId: merchant.merchant_id,
                error: error.message
              });
            }
          })
        );

        // Add delay between batches to avoid rate limiting
        if (i + batchSize < merchants.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Status check complete: ${results.checked} checked, ${results.updated} updated`);
      return results;
    } catch (error: any) {
      const errorMsg = `Error in status check: ${error.message}`;
      console.error(errorMsg);
      return {
        success: false,
        totalMerchants: 0,
        checked: 0,
        updated: 0,
        errors: [{ error: errorMsg }]
      };
    }
  }

  /**
   * Start scheduled status checks
   */
  static startScheduler(intervalMinutes: number = 1): void {
    console.log(`Starting scheduler with ${intervalMinutes} minute interval`);

    // Schedule the job
    const rule = new schedule.RecurrenceRule();
    rule.minute = new schedule.Range(0, 59, intervalMinutes);

    schedule.scheduleJob(rule, async () => {
      console.log(`Running scheduled status check at ${new Date().toISOString()}`);
      await this.checkAllMerchantStatuses();
    });

    console.log('Scheduler started successfully');
  }
}

// Export for use in other modules
export default IFoodMerchantStatusService;