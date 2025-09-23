/**
 * iFood Event Service  
 * Created: 18/08/2025
 * Purpose: Event processing and acknowledgment system for iFood integration
 * CRITICAL: 100% acknowledgment rate required for iFood compliance
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import {
  PollingEvent,
  EventEntity,
  AcknowledgmentRequest,
  AcknowledgmentResponse,
  AcknowledgmentResult,
  AcknowledgmentBatch,
  BatchStatus,
  ServiceResult,
  OrderServiceConfig
} from './types/orderTypes';
import { 
  AdvancedRetryEngine, 
  AcknowledgmentRetryOrchestrator, 
  retryUtils,
  RetryConfig 
} from './utils/retryUtils';

export class IFoodEventService {
  private supabase;
  private config: OrderServiceConfig;
  private activeBatches: Map<string, AcknowledgmentBatch> = new Map();

  // iFood API URLs - Reference: https://developer.ifood.com.br/pt-BR/docs/references/
  private readonly IFOOD_ACKNOWLEDGMENT_URL = 'https://merchant-api.ifood.com.br/events/v1.0/events/acknowledgment';
  
  // iFood limits: Maximum 2000 event IDs per acknowledgment request
  private readonly MAX_EVENTS_PER_BATCH = 2000;

  constructor(supabaseUrl: string, supabaseKey: string, config?: Partial<OrderServiceConfig>) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      pollingIntervalMs: 30000,
      pollingTimeoutMs: 10000,
      maxEventsPerPoll: 1000,
      maxEventsPerAcknowledgment: 2000,
      acknowledgmentRetryAttempts: 3,
      acknowledgmentRetryDelayMs: 1000,
      acknowledgmentTimeoutMs: 10000,
      batchProcessingSize: 100,
      maxConcurrentBatches: 5,
      processingTimeoutMs: 30000,
      enablePerformanceMonitoring: true,
      logDetailedMetrics: true,
      enableMemoryMonitoring: true,
      enableAutoRetry: true,
      maxRetryAttempts: 3,
      retryBackoffMultiplier: 2,
      enableRateLimiting: true,
      maxRequestsPerMinute: 120,
      enableTokenRefresh: true,
      ...config
    };

    console.log('✅ [EVENT-SERVICE] Initialized with acknowledgment config:', {
      maxEventsPerBatch: this.MAX_EVENTS_PER_BATCH,
      retryAttempts: this.config.acknowledgmentRetryAttempts,
      timeoutMs: this.config.acknowledgmentTimeoutMs
    });
  }

  /**
   * Get access token for user
   */
  private async getTokenForUser(userId: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('ifood_tokens')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        console.error(`❌ [EVENT-SERVICE] No token found for user: ${userId}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ [EVENT-SERVICE] Error fetching token:', error);
      return null;
    }
  }

  /**
   * Get pending events that need acknowledgment
   */
  async getPendingAcknowledgments(userId: string, limit: number = 2000): Promise<ServiceResult<EventEntity[]>> {
    try {
      console.log(`📋 [EVENT-SERVICE] Fetching pending acknowledgments for user: ${userId} (limit: ${limit})`);

      const { data, error } = await this.supabase
        .from('ifood_events')
        .select('*')
        .eq('user_id', userId)
        .eq('acknowledgment_success', false)
        .lt('acknowledgment_attempts', this.config.acknowledgmentRetryAttempts)
        .order('received_at', { ascending: true }) // FIFO processing
        .limit(Math.min(limit, this.MAX_EVENTS_PER_BATCH));

      if (error) {
        console.error('❌ [EVENT-SERVICE] Error fetching pending events:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`
        };
      }

      const events = data || [];
      console.log(`📊 [EVENT-SERVICE] Found ${events.length} pending acknowledgments`);

      return {
        success: true,
        data: events,
        metadata: {
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error: any) {
      const errorMsg = `Error fetching pending acknowledgments: ${error.message || error}`;
      console.error('❌ [EVENT-SERVICE]', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * SECURITY & COMPLIANCE: Input validation for acknowledgment requests
   * Validates all inputs before processing to prevent security issues
   */
  private validateAcknowledgmentInput(eventIds: string[], userId: string): { valid: boolean; error?: string } {
    // Security: Validate userId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return { valid: false, error: 'Invalid userId format - must be UUID' };
    }

    // Security: Validate eventIds array
    if (!Array.isArray(eventIds)) {
      return { valid: false, error: 'eventIds must be an array' };
    }

    if (eventIds.length === 0) {
      return { valid: false, error: 'eventIds array cannot be empty' };
    }

    // CRITICAL: iFood API limit validation
    if (eventIds.length > this.MAX_EVENTS_PER_BATCH) {
      return { valid: false, error: `Batch size exceeds iFood limit: ${eventIds.length} > ${this.MAX_EVENTS_PER_BATCH}` };
    }

    // Security: Validate each event ID format
    for (const eventId of eventIds) {
      if (typeof eventId !== 'string' || eventId.trim().length === 0) {
        return { valid: false, error: `Invalid event ID: ${eventId}` };
      }
      
      // Security: Prevent injection attacks
      if (eventId.includes('<') || eventId.includes('>') || eventId.includes('script')) {
        return { valid: false, error: `Potentially malicious event ID detected: ${eventId}` };
      }
    }

    return { valid: true };
  }

  /**
   * SECURITY: Rate limiting check for acknowledgment requests
   */
  private async checkAcknowledgmentRateLimit(userId: string): Promise<{ allowed: boolean; error?: string }> {
    try {
      // Check recent acknowledgment requests (last minute)
      const { data: recentBatches, error } = await this.supabase
        .from('ifood_acknowledgment_batches')
        .select('started_at')
        .eq('user_id', userId)
        .gte('started_at', new Date(Date.now() - 60 * 1000).toISOString());

      if (error) {
        console.error('❌ [EVENT-SERVICE] Error checking rate limit:', error);
        return { allowed: true }; // Allow on error to not block legitimate requests
      }

      const requestsLastMinute = recentBatches?.length || 0;
      const maxRequestsPerMinute = this.config.maxRequestsPerMinute || 60;

      if (requestsLastMinute >= maxRequestsPerMinute) {
        return { 
          allowed: false, 
          error: `Rate limit exceeded: ${requestsLastMinute} requests in last minute (limit: ${maxRequestsPerMinute})` 
        };
      }

      return { allowed: true };
    } catch (error: any) {
      console.error('❌ [EVENT-SERVICE] Rate limit check failed:', error);
      return { allowed: true }; // Allow on error
    }
  }

  /**
   * Execute acknowledgment for a batch of events
   * CRITICAL: Must achieve 100% success rate for iFood compliance
   * SECURITY: Full validation and rate limiting applied
   */
  async acknowledgeEvents(eventIds: string[], userId: string): Promise<AcknowledgmentResult> {
    const startTime = Date.now();
    const batchId = `batch_${userId}_${startTime}`;

    try {
      console.log(`\n✅ [EVENT-SERVICE] ========== ACKNOWLEDGMENT START ==========`);
      console.log(`🎯 [EVENT-SERVICE] Batch ID: ${batchId}`);
      console.log(`👤 [EVENT-SERVICE] User: ${userId}`);
      console.log(`📊 [EVENT-SERVICE] Event count: ${eventIds.length}`);
      console.log(`⏱️ [EVENT-SERVICE] Started at: ${new Date().toISOString()}`);

      // SECURITY: Comprehensive input validation
      const inputValidation = this.validateAcknowledgmentInput(eventIds, userId);
      if (!inputValidation.valid) {
        throw new Error(`Security validation failed: ${inputValidation.error}`);
      }

      // SECURITY: Rate limiting check
      const rateLimitCheck = await this.checkAcknowledgmentRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit validation failed: ${rateLimitCheck.error}`);
      }

      console.log(`🛡️ [EVENT-SERVICE] Security validations passed`);

      // COMPLIANCE: Log security validation success
      console.log(`✅ [EVENT-SERVICE] Input validation: PASSED`);
      console.log(`✅ [EVENT-SERVICE] Rate limit check: PASSED`);
      console.log(`✅ [EVENT-SERVICE] Batch size validation: ${eventIds.length}/${this.MAX_EVENTS_PER_BATCH} (COMPLIANT)`);

      if (eventIds.length === 0) {
        console.log(`📭 [EVENT-SERVICE] No events to acknowledge`);
        return {
          success: true,
          data: {
            batchId,
            totalEvents: 0,
            successfulEvents: 0,
            failedEvents: 0,
            processingTimeMs: Date.now() - startTime
          },
          metadata: {
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      // Get access token
      const tokenData = await this.getTokenForUser(userId);
      if (!tokenData || !tokenData.access_token) {
        throw new Error('No valid access token found for user');
      }

      // Prepare acknowledgment request - EXACT iFood format
      const acknowledgmentPayload = eventIds.map(id => ({ id }));

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'iFood-Acknowledgment-Service/1.0.0',
        'Cache-Control': 'no-cache'
      };

      console.log(`📤 [EVENT-SERVICE] Acknowledgment payload:`, JSON.stringify(acknowledgmentPayload, null, 2));
      console.log(`🔑 [EVENT-SERVICE] Token: ${tokenData.access_token.substring(0, 20)}...`);

      // Create batch record
      await this.createAcknowledgmentBatch({
        id: batchId,
        user_id: userId,
        batch_size: eventIds.length,
        event_ids: eventIds,
        started_at: new Date(startTime).toISOString(),
        success: false,
        successful_acknowledgments: 0,
        failed_acknowledgments: 0,
        retry_attempts: 0,
        max_retries: this.config.acknowledgmentRetryAttempts
      });

      // SECURITY & RELIABILITY: Execute acknowledgment with retry logic
      console.log(`🔄 [EVENT-SERVICE] Preparing acknowledgment execution with retry logic...`);
      
      // Create acknowledgment function for retry system
      const acknowledgmentFunction = async () => {
        console.log(`📡 [EVENT-SERVICE] Executing acknowledgment API call...`);
        
        const apiStartTime = Date.now();
        const response = await axios.post(
          this.IFOOD_ACKNOWLEDGMENT_URL,
          acknowledgmentPayload,
          {
            headers,
            timeout: this.config.acknowledgmentTimeoutMs,
            // SECURITY: Additional axios security configurations
            maxRedirects: 3,
            validateStatus: (status) => status >= 200 && status < 300,
            // Prevent request tampering
            maxContentLength: 1024 * 1024, // 1MB max response
            maxBodyLength: 1024 * 1024      // 1MB max request
          }
        );
        const apiEndTime = Date.now();
        
        console.log(`📥 [EVENT-SERVICE] API Response: ${response.status} (${apiEndTime - apiStartTime}ms)`);
        
        return {
          response,
          apiResponseTime: apiEndTime - apiStartTime
        };
      };

      // Execute with advanced retry logic
      const retryResult = await AcknowledgmentRetryOrchestrator.executeAcknowledgmentWithRetry(
        acknowledgmentFunction,
        eventIds,
        userId,
        {
          maxAttempts: this.config.acknowledgmentRetryAttempts,
          initialDelayMs: this.config.acknowledgmentRetryDelayMs,
          enableCircuitBreaker: true
        }
      );

      if (!retryResult.success) {
        throw new Error(`Acknowledgment failed after ${retryResult.finalAttempt} attempts: ${retryResult.error}`);
      }

      const { response, apiResponseTime } = retryResult.data!;
      console.log(`✅ [EVENT-SERVICE] Acknowledgment succeeded on attempt ${retryResult.finalAttempt}`);

      console.log(`📥 [EVENT-SERVICE] Acknowledgment API Response: ${response.status}`);
      console.log(`⚡ [EVENT-SERVICE] API Response Time: ${apiResponseTime}ms`);
      console.log(`📊 [EVENT-SERVICE] Response Data:`, JSON.stringify(response.data, null, 2));

      // Process response
      const acknowledgmentResponse = response.data;
      const isSuccess = response.status === 200 && acknowledgmentResponse.success !== false;
      
      let successfulEvents = eventIds.length;
      let failedEvents = 0;
      let failedEventIds: string[] = [];

      // Handle partial failures (if API returns specific failed event IDs)
      if (acknowledgmentResponse.errors && Array.isArray(acknowledgmentResponse.errors)) {
        failedEventIds = acknowledgmentResponse.errors.map((err: any) => err.eventId || err.id);
        failedEvents = failedEventIds.length;
        successfulEvents = eventIds.length - failedEvents;
      }

      // Update events in database
      if (successfulEvents > 0) {
        const successfulIds = eventIds.filter(id => !failedEventIds.includes(id));
        await this.markEventsAsAcknowledged(successfulIds, userId, batchId);
      }

      if (failedEvents > 0) {
        await this.markEventsAsAcknowledgmentFailed(failedEventIds, userId, batchId);
      }

      // Update batch record
      await this.updateAcknowledgmentBatch(batchId, {
        completed_at: new Date().toISOString(),
        success: isSuccess && failedEvents === 0,
        successful_acknowledgments: successfulEvents,
        failed_acknowledgments: failedEvents,
        failed_event_ids: failedEventIds,
        api_response_time_ms: apiResponseTime,
        api_status_code: response.status,
        api_response: acknowledgmentResponse,
        processing_duration_ms: Date.now() - startTime
      });

      const result: AcknowledgmentResult = {
        success: isSuccess && failedEvents === 0,
        data: {
          batchId,
          totalEvents: eventIds.length,
          successfulEvents,
          failedEvents,
          processingTimeMs: Date.now() - startTime
        },
        error: failedEvents > 0 ? `${failedEvents} events failed acknowledgment` : undefined,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      if (result.success) {
        console.log(`✅ [EVENT-SERVICE] ========== ACKNOWLEDGMENT SUCCESS ==========`);
        console.log(`📊 [EVENT-SERVICE] ${successfulEvents}/${eventIds.length} events acknowledged`);
      } else {
        console.log(`⚠️ [EVENT-SERVICE] ========== ACKNOWLEDGMENT PARTIAL ==========`);
        console.log(`📊 [EVENT-SERVICE] ${successfulEvents}/${eventIds.length} events acknowledged`);
        console.log(`❌ [EVENT-SERVICE] Failed events: ${failedEventIds.join(', ')}`);
      }
      console.log(`⏱️ [EVENT-SERVICE] Total duration: ${result.data.processingTimeMs}ms\n`);

      return result;

    } catch (error: any) {
      const errorMsg = `Acknowledgment failed: ${error.message || error}`;
      const duration = Date.now() - startTime;
      
      console.error(`❌ [EVENT-SERVICE] ========== ACKNOWLEDGMENT FAILED ==========`);
      console.error(`❌ [EVENT-SERVICE] Batch ID: ${batchId}`);
      console.error(`❌ [EVENT-SERVICE] Error: ${errorMsg}`);
      console.error(`⏱️ [EVENT-SERVICE] Duration before failure: ${duration}ms\n`);

      // Update batch record with failure
      await this.updateAcknowledgmentBatch(batchId, {
        completed_at: new Date().toISOString(),
        success: false,
        failed_acknowledgments: eventIds.length,
        api_status_code: error.response?.status,
        api_error_message: error.response?.data?.message || error.message,
        processing_duration_ms: duration
      });

      // Mark all events as acknowledgment failed
      await this.markEventsAsAcknowledgmentFailed(eventIds, userId, batchId);

      return {
        success: false,
        error: errorMsg,
        metadata: {
          executionTimeMs: duration,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Mark events as successfully acknowledged in database
   */
  private async markEventsAsAcknowledged(eventIds: string[], userId: string, batchId: string): Promise<void> {
    try {
      console.log(`✅ [EVENT-SERVICE] Marking ${eventIds.length} events as acknowledged`);

      const { error } = await this.supabase
        .from('ifood_events')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledgment_success: true,
          acknowledgment_response: { batchId, status: 'SUCCESS' },
          updated_at: new Date().toISOString()
        })
        .in('event_id', eventIds)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [EVENT-SERVICE] Error marking events as acknowledged:', error);
      } else {
        console.log(`✅ [EVENT-SERVICE] ${eventIds.length} events marked as acknowledged`);
      }
    } catch (error) {
      console.error('❌ [EVENT-SERVICE] Error marking events as acknowledged:', error);
    }
  }

  /**
   * Mark events as acknowledgment failed and increment retry counter
   */
  private async markEventsAsAcknowledgmentFailed(eventIds: string[], userId: string, batchId: string): Promise<void> {
    try {
      console.log(`❌ [EVENT-SERVICE] Marking ${eventIds.length} events as acknowledgment failed`);

      const { error } = await this.supabase
        .from('ifood_events')
        .update({
          acknowledgment_attempts: this.supabase.rpc('increment_acknowledgment_attempts'),
          acknowledgment_response: { batchId, status: 'FAILED' },
          updated_at: new Date().toISOString()
        })
        .in('event_id', eventIds)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [EVENT-SERVICE] Error marking events as failed:', error);
      } else {
        console.log(`⚠️ [EVENT-SERVICE] ${eventIds.length} events marked as acknowledgment failed`);
      }
    } catch (error) {
      console.error('❌ [EVENT-SERVICE] Error marking events as failed:', error);
    }
  }

  /**
   * Create acknowledgment batch record for tracking
   */
  private async createAcknowledgmentBatch(batchData: any): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ifood_acknowledgment_batches')
        .insert(batchData);

      if (error) {
        console.error('❌ [EVENT-SERVICE] Error creating batch record:', error);
      }
    } catch (error) {
      console.error('❌ [EVENT-SERVICE] Error creating batch record:', error);
    }
  }

  /**
   * Update acknowledgment batch record
   */
  private async updateAcknowledgmentBatch(batchId: string, updateData: any): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ifood_acknowledgment_batches')
        .update(updateData)
        .eq('id', batchId);

      if (error) {
        console.error('❌ [EVENT-SERVICE] Error updating batch record:', error);
      }
    } catch (error) {
      console.error('❌ [EVENT-SERVICE] Error updating batch record:', error);
    }
  }

  /**
   * Auto-acknowledge events immediately after they are received
   * CRITICAL: This is called automatically after each polling cycle
   * PERFORMANCE: Optimized for immediate processing to maintain 100% acknowledgment rate
   */
  async autoAcknowledgeRecentEvents(userId: string, maxAgeMinutes: number = 2): Promise<AcknowledgmentResult> {
    const startTime = Date.now();

    try {
      console.log(`🚀 [EVENT-SERVICE] Auto-acknowledging recent events for user: ${userId} (max age: ${maxAgeMinutes}min)`);

      // Get events received in the last few minutes that need acknowledgment
      const { data: recentEvents, error } = await this.supabase
        .from('ifood_events')
        .select('event_id')
        .eq('user_id', userId)
        .eq('acknowledgment_success', false)
        .gte('received_at', new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString())
        .order('received_at', { ascending: true })
        .limit(this.MAX_EVENTS_PER_BATCH);

      if (error) {
        console.error('❌ [EVENT-SERVICE] Error fetching recent events:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
          metadata: {
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      if (!recentEvents || recentEvents.length === 0) {
        console.log(`📭 [EVENT-SERVICE] No recent events to acknowledge for user: ${userId}`);
        return {
          success: true,
          data: {
            batchId: `auto_${userId}_${startTime}`,
            totalEvents: 0,
            successfulEvents: 0,
            failedEvents: 0,
            processingTimeMs: Date.now() - startTime
          },
          metadata: {
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      const eventIds = recentEvents.map(e => e.event_id);
      console.log(`🎯 [EVENT-SERVICE] Auto-acknowledging ${eventIds.length} recent events`);

      // Execute acknowledgment
      const result = await this.acknowledgeEvents(eventIds, userId);
      
      console.log(`✅ [EVENT-SERVICE] Auto-acknowledgment completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      
      return result;

    } catch (error: any) {
      const errorMsg = `Auto-acknowledgment failed: ${error.message || error}`;
      console.error(`❌ [EVENT-SERVICE] ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Process all pending acknowledgments for a user
   * This should be called after each polling cycle
   */
  async processAllPendingAcknowledgments(userId: string): Promise<ServiceResult<{ 
    totalBatches: number; 
    successfulBatches: number; 
    failedBatches: number; 
    totalEvents: number;
    acknowledgedEvents: number;
  }>> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 [EVENT-SERVICE] Processing all pending acknowledgments for user: ${userId}`);

      // Get all pending events
      const pendingResult = await this.getPendingAcknowledgments(userId);
      if (!pendingResult.success || !pendingResult.data) {
        return {
          success: false,
          error: pendingResult.error || 'No pending events found'
        };
      }

      const pendingEvents = pendingResult.data;
      if (pendingEvents.length === 0) {
        console.log(`📭 [EVENT-SERVICE] No pending acknowledgments for user: ${userId}`);
        return {
          success: true,
          data: {
            totalBatches: 0,
            successfulBatches: 0,
            failedBatches: 0,
            totalEvents: 0,
            acknowledgedEvents: 0
          }
        };
      }

      // Split into batches (max 2000 per batch)
      const batches: string[][] = [];
      for (let i = 0; i < pendingEvents.length; i += this.MAX_EVENTS_PER_BATCH) {
        const batch = pendingEvents.slice(i, i + this.MAX_EVENTS_PER_BATCH);
        batches.push(batch.map(event => event.event_id));
      }

      console.log(`📦 [EVENT-SERVICE] Created ${batches.length} batches for acknowledgment`);

      // Process each batch
      let successfulBatches = 0;
      let failedBatches = 0;
      let totalAcknowledgedEvents = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`📦 [EVENT-SERVICE] Processing batch ${i + 1}/${batches.length} (${batch.length} events)`);

        const batchResult = await this.acknowledgeEvents(batch, userId);
        
        if (batchResult.success) {
          successfulBatches++;
          totalAcknowledgedEvents += batchResult.data?.successfulEvents || 0;
        } else {
          failedBatches++;
          
          // If batch failed, implement retry logic
          if (this.config.enableAutoRetry) {
            console.log(`🔄 [EVENT-SERVICE] Retrying failed batch ${i + 1} after delay...`);
            await new Promise(resolve => setTimeout(resolve, this.config.acknowledgmentRetryDelayMs));
            
            const retryResult = await this.acknowledgeEvents(batch, userId);
            if (retryResult.success) {
              successfulBatches++;
              failedBatches--;
              totalAcknowledgedEvents += retryResult.data?.successfulEvents || 0;
              console.log(`✅ [EVENT-SERVICE] Batch ${i + 1} succeeded on retry`);
            } else {
              console.log(`❌ [EVENT-SERVICE] Batch ${i + 1} failed on retry`);
            }
          }
        }

        // Small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const result = {
        totalBatches: batches.length,
        successfulBatches,
        failedBatches,
        totalEvents: pendingEvents.length,
        acknowledgedEvents: totalAcknowledgedEvents
      };

      console.log(`✅ [EVENT-SERVICE] ========== ACKNOWLEDGMENT PROCESSING COMPLETE ==========`);
      console.log(`📊 [EVENT-SERVICE] Results:`, result);
      console.log(`⏱️ [EVENT-SERVICE] Total duration: ${Date.now() - startTime}ms\n`);

      return {
        success: failedBatches === 0,
        data: result,
        error: failedBatches > 0 ? `${failedBatches} batches failed acknowledgment` : undefined,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

    } catch (error: any) {
      const errorMsg = `Error processing acknowledgments: ${error.message || error}`;
      console.error(`❌ [EVENT-SERVICE] ========== ACKNOWLEDGMENT PROCESSING FAILED ==========`);
      console.error(`❌ [EVENT-SERVICE] Error: ${errorMsg}`);
      console.error(`⏱️ [EVENT-SERVICE] Duration before failure: ${Date.now() - startTime}ms\n`);

      return {
        success: false,
        error: errorMsg,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Get acknowledgment statistics for monitoring
   */
  async getAcknowledgmentStatistics(userId: string): Promise<ServiceResult<any>> {
    const startTime = Date.now();
    try {
      console.log(`📊 [EVENT-SERVICE] Fetching acknowledgment statistics for user: ${userId}`);

      // Get last 24 hours of acknowledgment data
      const { data: batches, error: batchError } = await this.supabase
        .from('ifood_acknowledgment_batches')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false });

      if (batchError) {
        console.error('❌ [EVENT-SERVICE] Error fetching batch statistics:', batchError);
        return {
          success: false,
          error: `Database error: ${batchError.message}`
        };
      }

      // Get event statistics
      const { data: events, error: eventError } = await this.supabase
        .from('ifood_events')
        .select('acknowledgment_success, acknowledgment_attempts, acknowledged_at')
        .eq('user_id', userId)
        .gte('received_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (eventError) {
        console.error('❌ [EVENT-SERVICE] Error fetching event statistics:', eventError);
        return {
          success: false,
          error: `Database error: ${eventError.message}`
        };
      }

      // Calculate statistics
      const stats = {
        last24Hours: {
          totalBatches: batches?.length || 0,
          successfulBatches: batches?.filter(b => b.success).length || 0,
          failedBatches: batches?.filter(b => !b.success).length || 0,
          totalEvents: batches?.reduce((sum, b) => sum + (b.batch_size || 0), 0) || 0,
          acknowledgedEvents: events?.filter(e => e.acknowledgment_success).length || 0,
          pendingEvents: events?.filter(e => !e.acknowledgment_success).length || 0,
          avgBatchSize: batches?.length ? 
            batches.reduce((sum, b) => sum + (b.batch_size || 0), 0) / batches.length : 0,
          avgProcessingTime: batches?.length ?
            batches.reduce((sum, b) => sum + (b.processing_duration_ms || 0), 0) / batches.length : 0,
          successRate: events?.length ?
            (events.filter(e => e.acknowledgment_success).length / events.length * 100) : 100
        },
        overall: {
          isRunning: false, // Will be updated based on actual polling state
          lastAcknowledgment: batches?.[0]?.completed_at,
          avgRetryAttempts: events?.length ?
            events.reduce((sum, e) => sum + (e.acknowledgment_attempts || 0), 0) / events.length : 0,
          maxRetryAttempts: this.config.acknowledgmentRetryAttempts
        }
      };

      console.log(`📊 [EVENT-SERVICE] Acknowledgment statistics:`, stats);

      return {
        success: true,
        data: stats,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error: any) {
      const errorMsg = `Error fetching acknowledgment statistics: ${error.message || error}`;
      console.error('❌ [EVENT-SERVICE]', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Retry failed acknowledgments that are within retry limits
   */
  async retryFailedAcknowledgments(userId: string): Promise<ServiceResult<any>> {
    try {
      console.log(`🔄 [EVENT-SERVICE] Retrying failed acknowledgments for user: ${userId}`);

      // Get events that failed but are still within retry limits
      const { data: retryableEvents, error } = await this.supabase
        .from('ifood_events')
        .select('event_id')
        .eq('user_id', userId)
        .eq('acknowledgment_success', false)
        .lt('acknowledgment_attempts', this.config.acknowledgmentRetryAttempts)
        .order('received_at', { ascending: true });

      if (error) {
        return {
          success: false,
          error: `Database error: ${error.message}`
        };
      }

      if (!retryableEvents || retryableEvents.length === 0) {
        console.log(`📭 [EVENT-SERVICE] No retryable acknowledgments found for user: ${userId}`);
        return {
          success: true,
          data: { retriedEvents: 0, message: 'No events to retry' }
        };
      }

      const eventIds = retryableEvents.map(e => e.event_id);
      console.log(`🔄 [EVENT-SERVICE] Retrying acknowledgment for ${eventIds.length} events`);

      // Process acknowledgments for retryable events
      const retryResult = await this.processAllPendingAcknowledgments(userId);

      return {
        success: retryResult.success,
        data: {
          retriedEvents: eventIds.length,
          ...retryResult.data
        },
        error: retryResult.error
      };
    } catch (error: any) {
      const errorMsg = `Error retrying failed acknowledgments: ${error.message || error}`;
      console.error('❌ [EVENT-SERVICE]', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Health check for event service
   */
  async healthCheck(userId?: string): Promise<ServiceResult<any>> {
    try {
      const healthData: any = {
        service: 'ifood-event-service',
        status: 'HEALTHY',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config: {
          maxEventsPerBatch: this.MAX_EVENTS_PER_BATCH,
          retryAttempts: this.config.acknowledgmentRetryAttempts,
          timeoutMs: this.config.acknowledgmentTimeoutMs
        }
      };

      // If specific user provided, get their acknowledgment status
      if (userId) {
        const statsResult = await this.getAcknowledgmentStatistics(userId);
        if (statsResult.success) {
          healthData.userStatistics = statsResult.data;
        }
      }

      // Get overall system statistics
      const { data: systemStats, error: statsError } = await this.supabase
        .from('ifood_events')
        .select('acknowledgment_success, acknowledgment_attempts')
        .gte('received_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      if (!statsError && systemStats) {
        healthData.systemHealth = {
          totalEventsLastHour: systemStats.length,
          acknowledgedEventsLastHour: systemStats.filter(e => e.acknowledgment_success).length,
          pendingEventsLastHour: systemStats.filter(e => !e.acknowledgment_success).length,
          avgRetryAttempts: systemStats.length ? 
            systemStats.reduce((sum, e) => sum + (e.acknowledgment_attempts || 0), 0) / systemStats.length : 0
        };
      }

      return {
        success: true,
        data: healthData,
        metadata: {
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Health check failed: ${error.message || error}`
      };
    }
  }
}

export default IFoodEventService;