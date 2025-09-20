/**
 * iFood Order Service
 * Created: 18/08/2025
 * Purpose: Core order management service for iFood integration
 * Following existing patterns from ifoodMerchantService.ts
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { 
  IFoodOrder, 
  OrderEntity, 
  ServiceResult, 
  VirtualBagRequest, 
  VirtualBagResponse,
  VirtualBagResult,
  OrderServiceConfig 
} from './types/orderTypes';

// Default configuration following iFood requirements
const DEFAULT_CONFIG: OrderServiceConfig = {
  // Polling Configuration (exact requirements from iFood)
  pollingIntervalMs: 30000, // Exactly 30 seconds
  pollingTimeoutMs: 10000,
  maxEventsPerPoll: 1000,
  
  // Acknowledgment Configuration (iFood limits)
  maxEventsPerAcknowledgment: 2000, // iFood maximum
  acknowledgmentRetryAttempts: 3,
  acknowledgmentRetryDelayMs: 1000,
  acknowledgmentTimeoutMs: 10000,
  
  // Processing Configuration
  batchProcessingSize: 100,
  maxConcurrentBatches: 5,
  processingTimeoutMs: 30000,
  
  // Performance Configuration
  enablePerformanceMonitoring: true,
  logDetailedMetrics: true,
  enableMemoryMonitoring: true,
  
  // Error Handling
  enableAutoRetry: true,
  maxRetryAttempts: 3,
  retryBackoffMultiplier: 2,
  
  // Security
  enableRateLimiting: true,
  maxRequestsPerMinute: 120, // Conservative limit
  enableTokenRefresh: true
};

export class IFoodOrderService {
  private supabase;
  private config: OrderServiceConfig;
  
  // iFood API URLs (will be validated against official documentation)
  private readonly IFOOD_ORDERS_BASE_URL = 'https://merchant-api.ifood.com.br/order/v1.0';
  private readonly IFOOD_POLLING_URL = `${this.IFOOD_ORDERS_BASE_URL}/polling`;
  private readonly IFOOD_ACKNOWLEDGMENT_URL = `${this.IFOOD_ORDERS_BASE_URL}/acknowledgment`;
  private readonly IFOOD_VIRTUAL_BAG_URL = `${this.IFOOD_ORDERS_BASE_URL}/orders`;

  constructor(supabaseUrl: string, supabaseKey: string, config?: Partial<OrderServiceConfig>) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    console.log('🏪 IFoodOrderService initialized');
    console.log('⚙️ Configuration:', {
      pollingInterval: `${this.config.pollingIntervalMs}ms`,
      maxEventsPerPoll: this.config.maxEventsPerPoll,
      maxEventsPerAck: this.config.maxEventsPerAcknowledgment,
      retryAttempts: this.config.acknowledgmentRetryAttempts
    });
  }

  /**
   * Get access token from database for a specific user
   * Reusing pattern from ifoodMerchantService.ts
   */
  async getTokenFromDb(userId: string): Promise<any | null> {
    try {
      console.log(`🔍 [ORDER-SERVICE] Fetching token for user_id: ${userId}`);

      const { data, error } = await this.supabase
        .from('ifood_tokens')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ [ORDER-SERVICE] Error fetching token:', error);
        return null;
      }

      if (data) {
        console.log('✅ [ORDER-SERVICE] Token found for user');
        return data;
      } else {
        console.log('📭 [ORDER-SERVICE] No token found for user');
        return null;
      }
    } catch (error) {
      console.error('❌ [ORDER-SERVICE] Error fetching token:', error);
      return null;
    }
  }

  /**
   * Validate if user has access to specific merchant
   * Security check for merchant ownership (following existing pattern)
   */
  async validateMerchantOwnership(merchantId: string, userId: string): Promise<boolean> {
    try {
      console.log(`🔍 [ORDER-SERVICE] Validating ownership - Merchant: ${merchantId}, User: ${userId}`);

      const { data, error } = await this.supabase
        .from('ifood_merchants')
        .select('merchant_id, user_id')
        .eq('merchant_id', merchantId)
        .eq('user_id', userId)
        .single();

      console.log(`📊 [ORDER-SERVICE] Query result - Data:`, data);
      console.log(`📊 [ORDER-SERVICE] Query result - Error:`, error);

      if (error || !data) {
        console.log(`🚫 [ORDER-SERVICE] Access denied: Merchant ${merchantId} not owned by user ${userId}`);
        console.log(`🚫 [ORDER-SERVICE] Error details:`, error);
        return false;
      }

      console.log(`✅ [ORDER-SERVICE] Access validated: User ${userId} owns merchant ${merchantId}`);
      return true;
    } catch (error) {
      console.error('❌ [ORDER-SERVICE] Error validating merchant ownership:', error);
      return false;
    }
  }

  /**
   * Get merchant IDs for a user (for x-polling-merchants header)
   * Following pattern from ifoodMerchantService.ts
   */
  async getUserMerchantIds(userId: string): Promise<{ success: boolean; merchant_ids: string[]; error?: string }> {
    try {
      console.log(`📋 [ORDER-SERVICE] Fetching merchant IDs for user: ${userId}`);

      const { data, error } = await this.supabase
        .from('ifood_merchants')
        .select('merchant_id')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [ORDER-SERVICE] Error fetching user merchants:', error);
        return {
          success: false,
          merchant_ids: [],
          error: `Database error: ${error.message}`
        };
      }

      const merchantIds = data ? data.map(row => row.merchant_id) : [];
      console.log(`📊 [ORDER-SERVICE] Found ${merchantIds.length} merchants for user ${userId}`);

      return {
        success: true,
        merchant_ids: merchantIds
      };
    } catch (error: any) {
      const errorMsg = `Error fetching user merchants: ${error.message || error}`;
      console.error('❌ [ORDER-SERVICE]', errorMsg);
      return {
        success: false,
        merchant_ids: [],
        error: errorMsg
      };
    }
  }

  /**
   * Store order in database (from virtual bag import)
   */
  async storeOrder(order: Partial<OrderEntity>): Promise<ServiceResult<{ orderId: string }>> {
    try {
      console.log(`💾 [ORDER-SERVICE] Storing order ${order.ifood_order_id} in database...`);

      const { data, error } = await this.supabase
        .from('ifood_orders')
        .insert({
          ifood_order_id: order.ifood_order_id,
          merchant_id: order.merchant_id,
          user_id: order.user_id,
          status: order.status || 'PENDING',
          order_data: order.order_data,
          virtual_bag_data: order.virtual_bag_data,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address,
          total_amount: order.total_amount,
          delivery_fee: order.delivery_fee,
          payment_method: order.payment_method
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [ORDER-SERVICE] Database error:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
          metadata: {
            executionTimeMs: 0,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      console.log(`✅ [ORDER-SERVICE] Order ${order.ifood_order_id} stored successfully`);
      return {
        success: true,
        data: { orderId: data.id },
        metadata: {
          executionTimeMs: 0, // Will be calculated by caller
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error: any) {
      const errorMsg = `Error storing order: ${error.message || error}`;
      console.error('❌ [ORDER-SERVICE]', errorMsg);
      return {
        success: false,
        error: errorMsg,
        metadata: {
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * Get valid access token for a merchant
   */
  private async getValidAccessToken(merchantId: string): Promise<{ accessToken?: string }> {
    try {
      // Get merchant data to find user_id
      const { data: merchantData, error: merchantError } = await this.supabase
        .from('ifood_merchants')
        .select('user_id')
        .eq('merchant_id', merchantId)
        .single();

      if (merchantError || !merchantData) {
        console.error('❌ [ORDER-SERVICE] Merchant not found:', merchantId);
        return {};
      }

      // Get token for this user
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('ifood_tokens')
        .select('*')
        .eq('user_id', merchantData.user_id)
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.error('❌ [ORDER-SERVICE] Token not found for user:', merchantData.user_id);
        return {};
      }

      return { accessToken: tokenData.access_token };
    } catch (error: any) {
      console.error('❌ [ORDER-SERVICE] Error getting access token:', error.message);
      return {};
    }
  }

  /**
   * Send status update to iFood API
   */
  private async sendStatusUpdateToIfood(
    ifoodOrderId: string, 
    newStatus: OrderEntity['status'],
    merchantId: string,
    additionalData?: any
  ): Promise<boolean> {
    try {
      // Get current access token
      const tokenResult = await this.getValidAccessToken(merchantId);
      if (!tokenResult.accessToken) {
        console.error('❌ [ORDER-SERVICE] No valid access token for iFood API');
        return false;
      }

      // Map our status to iFood API endpoints
      let endpoint = '';
      let method = 'POST';
      
      switch (newStatus) {
        case 'PREPARING':
          // iFood uses "start preparation" event
          endpoint = `/order/v1.0/orders/${ifoodOrderId}/startPreparation`;
          break;
        case 'READY_FOR_PICKUP':
          // iFood uses "ready to pickup" event
          endpoint = `/order/v1.0/orders/${ifoodOrderId}/readyToPickup`;
          break;
        case 'DISPATCHED':
          // iFood uses "dispatch" event (for own delivery)
          endpoint = `/order/v1.0/orders/${ifoodOrderId}/dispatch`;
          break;
        case 'DELIVERED':
          // iFood uses "conclude" event
          endpoint = `/order/v1.0/orders/${ifoodOrderId}/conclude`;
          break;
        case 'CANCELLED':
          // For cancellation, we use a different endpoint
          endpoint = `/order/v1.0/orders/${ifoodOrderId}/requestCancellation`;
          break;
        default:
          console.log(`ℹ️ [ORDER-SERVICE] No iFood API call needed for status: ${newStatus}`);
          return true;
      }

      if (!endpoint) {
        return true;
      }

      // Prepare request body based on status
      let requestBody: any = {};
      if (newStatus === 'CANCELLED') {
        // For cancellation, we need to send both reason and cancellation code
        const cancellationCode = additionalData?.cancellationCode || '503'; // Default to ITEM_UNAVAILABLE
        const cancellationReason = additionalData?.cancellation_reason || 'Cancelled by merchant';
        requestBody = { 
          reason: cancellationReason,
          cancellationCode: cancellationCode 
        };
        console.log(`📦 [ORDER-SERVICE] Cancellation request with code: ${cancellationCode} and reason: ${cancellationReason}`);
      }

      // Make the API call to iFood
      console.log(`🌐 [ORDER-SERVICE] Calling iFood API: ${method} https://merchant-api.ifood.com.br${endpoint}`);
      console.log(`🔑 [ORDER-SERVICE] Using token: ${tokenResult.accessToken?.substring(0, 20)}...`);
      
      const response = await axios({
        method,
        url: `https://merchant-api.ifood.com.br${endpoint}`,
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
          'Content-Type': 'application/json'
        },
        data: method === 'POST' ? requestBody : undefined
      });

      console.log(`📥 [ORDER-SERVICE] iFood API Response Status: ${response.status}`);
      console.log(`📦 [ORDER-SERVICE] iFood API Response Data:`, response.data);
      console.log(`✅ [ORDER-SERVICE] iFood API status update sent: ${newStatus} for order ${ifoodOrderId}`);
      return true;
      
    } catch (error: any) {
      console.error(`❌ [ORDER-SERVICE] Failed to update status in iFood API:`, error.response?.data || error.message);
      // Don't fail the whole operation if iFood API fails
      return false;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    ifoodOrderId: string, 
    newStatus: OrderEntity['status'],
    userId: string,
    additionalData?: Partial<OrderEntity>
  ): Promise<ServiceResult<{ updated: boolean; ifoodApiUpdated?: boolean }>> {
    try {
      console.log(`🔄 [ORDER-SERVICE] Updating order ${ifoodOrderId} status to ${newStatus}`);

      // First, get the order to get merchantId
      const { data: orderData, error: fetchError } = await this.supabase
        .from('ifood_orders')
        .select('merchant_id, status')
        .eq('ifood_order_id', ifoodOrderId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !orderData) {
        return {
          success: false,
          error: `Order not found: ${fetchError?.message || 'Unknown error'}`
        };
      }

      // Prepare update data
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Add status-specific timestamps (only for existing columns)
      if (newStatus === 'CONFIRMED') {
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'DELIVERED') {
        updateData.delivered_at = new Date().toISOString();
      } else if (newStatus === 'CANCELLED') {
        updateData.cancelled_at = new Date().toISOString();
        if (additionalData?.cancellation_reason) {
          updateData.cancellation_reason = additionalData.cancellation_reason;
        }
        if (additionalData?.cancelled_by) {
          updateData.cancelled_by = additionalData.cancelled_by;
        }
      }

      // Apply additional data if provided (but exclude cancellationCode as it's not a DB field)
      if (additionalData) {
        const { cancellationCode, ...dataToStore } = additionalData as any;
        Object.assign(updateData, dataToStore);
      }

      // Update in database
      const { data, error } = await this.supabase
        .from('ifood_orders')
        .update(updateData)
        .eq('ifood_order_id', ifoodOrderId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ [ORDER-SERVICE] Failed to update order status:', error);
        return {
          success: false,
          error: `Failed to update order status: ${error.message}`
        };
      }

      // Send update to iFood API
      const ifoodApiUpdated = await this.sendStatusUpdateToIfood(
        ifoodOrderId, 
        newStatus, 
        orderData.merchant_id,
        additionalData
      );

      console.log(`✅ [ORDER-SERVICE] Order ${ifoodOrderId} status updated to ${newStatus} (iFood API: ${ifoodApiUpdated ? 'success' : 'failed'})`);
      
      return {
        success: true,
        data: { 
          updated: true,
          ifoodApiUpdated 
        },
        metadata: {
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          previousStatus: orderData.status
        }
      };
    } catch (error: any) {
      const errorMsg = `Error updating order status: ${error.message || error}`;
      console.error('❌ [ORDER-SERVICE]', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Get orders for a specific merchant with filtering
   */
  async getOrdersForMerchant(
    merchantId: string, 
    userId: string, 
    filters?: {
      status?: OrderEntity['status'];
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ServiceResult<{ orders: OrderEntity[]; total: number }>> {
    try {
      console.log(`📋 [ORDER-SERVICE] Fetching orders for merchant: ${merchantId}`);

      // Note: Removed ownership validation here because we want to allow
      // users to fetch orders from iFood API, following the same pattern
      // as the working merchant endpoints

      // Build query - Exclude CANCELLED and DELIVERED orders from main listing
      let query = this.supabase
        .from('ifood_orders')
        .select('*', { count: 'exact' })
        .eq('merchant_id', merchantId)
        .eq('user_id', userId)
        .neq('status', 'CANCELLED') // ✅ FILTER: Exclude cancelled orders
        .neq('status', 'DELIVERED'); // ✅ FILTER: Exclude completed orders (shown separately)

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Apply pagination
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);
      }

      // Order by created_at desc
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ [ORDER-SERVICE] Error fetching orders:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`
        };
      }

      console.log(`📊 [ORDER-SERVICE] Found ${data?.length || 0} orders for merchant ${merchantId}`);

      return {
        success: true,
        data: {
          orders: data || [],
          total: count || 0
        },
        metadata: {
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error: any) {
      const errorMsg = `Error fetching orders: ${error.message || error}`;
      console.error('❌ [ORDER-SERVICE]', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Process virtual bag order import
   * This will be the main entry point for orders coming from iFood
   */
  async processVirtualBagOrder(request: VirtualBagRequest): Promise<VirtualBagResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📦 [ORDER-SERVICE] Processing virtual bag order: ${request.orderId}`);
      console.log(`🏪 [ORDER-SERVICE] Merchant: ${request.merchantId}, User: ${request.userId}`);

      // Validate merchant ownership
      const hasAccess = await this.validateMerchantOwnership(request.merchantId, request.userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied: User does not own this merchant',
          metadata: {
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      // Check if order already exists (prevent duplicates)
      const { data: existingOrder } = await this.supabase
        .from('ifood_orders')
        .select('id, status')
        .eq('ifood_order_id', request.orderId)
        .eq('user_id', request.userId)
        .maybeSingle();

      if (existingOrder) {
        console.log(`⚠️ [ORDER-SERVICE] Order ${request.orderId} already exists with status: ${existingOrder.status}`);
        return {
          success: true,
          data: {
            orderId: request.orderId,
            internalOrderId: existingOrder.id,
            status: existingOrder.status,
            processingTimeMs: Date.now() - startTime
          },
          error: 'Order already exists',
          metadata: {
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      // Extract order information for database storage
      const orderData = request.orderData;
      const orderEntity: Partial<OrderEntity> = {
        ifood_order_id: request.orderId,
        merchant_id: request.merchantId,
        user_id: request.userId,
        status: 'PENDING',
        order_data: orderData,
        virtual_bag_data: request,
        
        // Extract customer information
        customer_name: orderData.customer?.name,
        customer_phone: orderData.customer?.phone,
        customer_address: orderData.customer?.address,
        
        // Extract financial information (support multiple data structures)
        total_amount: orderData.total?.total || orderData.total || (orderData as any).totalPrice || null,
        delivery_fee: orderData.total?.deliveryFee || (orderData as any).deliveryFee || null,
        payment_method: orderData.payments?.[0]?.method || (orderData as any).paymentMethod || null
      };

      // Store order in database
      const storeResult = await this.storeOrder(orderEntity);
      
      if (!storeResult.success) {
        return {
          success: false,
          error: storeResult.error,
          metadata: {
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      console.log(`✅ [ORDER-SERVICE] Virtual bag order processed successfully: ${request.orderId}`);
      
      return {
        success: true,
        data: {
          orderId: request.orderId,
          internalOrderId: storeResult.data?.orderId || '',
          status: 'PENDING',
          processingTimeMs: Date.now() - startTime
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

    } catch (error: any) {
      const errorMsg = `Error processing virtual bag order: ${error.message || error}`;
      console.error('❌ [ORDER-SERVICE]', errorMsg);
      
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
   * Get order by iFood order ID
   */
  async getOrderByIFoodId(ifoodOrderId: string, userId: string): Promise<ServiceResult<OrderEntity>> {
    try {
      console.log(`🔍 [ORDER-SERVICE] Fetching order: ${ifoodOrderId} for user: ${userId}`);

      const { data, error } = await this.supabase
        .from('ifood_orders')
        .select('*')
        .eq('ifood_order_id', ifoodOrderId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('❌ [ORDER-SERVICE] Error fetching order:', error);
        return {
          success: false,
          error: error.code === 'PGRST116' ? 'Order not found' : `Database error: ${error.message}`
        };
      }

      console.log(`✅ [ORDER-SERVICE] Order found: ${data.ifood_order_id} - Status: ${data.status}`);
      
      return {
        success: true,
        data: data as OrderEntity,
        metadata: {
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error: any) {
      const errorMsg = `Error fetching order: ${error.message || error}`;
      console.error('❌ [ORDER-SERVICE]', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Get orders statistics for dashboard
   */
  async getOrdersStatistics(
    userId: string, 
    merchantId?: string,
    timeRange: '24h' | '7d' | '30d' = '24h'
  ): Promise<ServiceResult<any>> {
    try {
      console.log(`📊 [ORDER-SERVICE] Fetching statistics for user: ${userId}, range: ${timeRange}`);

      // Calculate time range
      const intervals = {
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };
      
      const interval = intervals[timeRange];

      // Build base query
      let query = this.supabase
        .from('ifood_orders')
        .select('status, total_amount, created_at')
        .eq('user_id', userId)
        .gte('created_at', `NOW() - INTERVAL '${interval}'`);

      if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [ORDER-SERVICE] Error fetching statistics:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`
        };
      }

      // Calculate statistics
      const stats = {
        totalOrders: data?.length || 0,
        totalRevenue: data?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0,
        avgOrderValue: data?.length ? (data.reduce((sum, order) => sum + (order.total_amount || 0), 0) / data.length) : 0,
        ordersByStatus: data?.reduce((acc, order) => {
          acc[order.status] = (acc[order.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        timeRange,
        generatedAt: new Date().toISOString()
      };

      console.log(`📊 [ORDER-SERVICE] Statistics generated:`, stats);

      return {
        success: true,
        data: stats,
        metadata: {
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error: any) {
      const errorMsg = `Error fetching statistics: ${error.message || error}`;
      console.error('❌ [ORDER-SERVICE]', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Health check for order service
   */
  async healthCheck(userId: string): Promise<ServiceResult<any>> {
    try {
      const startTime = Date.now();
      
      // Check database connectivity - simple test without filtering
      const { data: dbTest, error: dbError } = await this.supabase
        .from('ifood_orders')
        .select('id')
        .limit(1);

      if (dbError) {
        return {
          success: false,
          error: `Database connectivity failed: ${dbError.message}`
        };
      }

      // Get recent statistics
      const recentStats = await this.getOrdersStatistics(userId, undefined, '24h');
      
      const healthData = {
        status: 'HEALTHY',
        database: 'CONNECTED',
        service: 'ifood-order-service',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
        statistics: recentStats.data || null
      };

      return {
        success: true,
        data: healthData,
        metadata: {
          executionTimeMs: Date.now() - startTime,
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

  /**
   * Get service configuration
   */
  getConfig(): OrderServiceConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<OrderServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ [ORDER-SERVICE] Configuration updated:', newConfig);
  }
}

export default IFoodOrderService;