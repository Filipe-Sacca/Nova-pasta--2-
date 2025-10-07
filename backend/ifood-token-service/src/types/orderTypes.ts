// Order types for iFood integration

export interface Order {
  id: string;
  reference?: string;
  shortReference?: string;
  createdAt: string;
  type: string;
  merchant: {
    id: string;
    name: string;
  };
  payments?: {
    prepaid: number;
    pending: number;
    methods: PaymentMethod[];
  };
  customer?: {
    id: string;
    name: string;
    phone?: string;
    documentNumber?: string;
  };
  items?: OrderItem[];
  subTotal?: number;
  totalPrice?: number;
  deliveryFee?: number;
  deliveryAddress?: DeliveryAddress;
  deliveryDateTime?: string;
  preparationStartDateTime?: string;
  salesChannel?: string;
}

export interface PaymentMethod {
  method: string;
  prepaid: boolean;
  currency: string;
  type: string;
  value: number;
  wallet?: string;
  issuer?: string;
  changeFor?: number;
}

export interface OrderItem {
  id: string;
  name: string;
  externalCode?: string;
  quantity: number;
  price: number;
  subItemsPrice: number;
  totalPrice: number;
  discount: number;
  addition: number;
  subItems?: SubItem[];
  observations?: string;
}

export interface SubItem {
  id: string;
  name: string;
  externalCode?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  discount: number;
  addition: number;
}

export interface DeliveryAddress {
  formattedAddress: string;
  country: string;
  state: string;
  city: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  neighborhood: string;
  streetName: string;
  streetNumber: string;
  postalCode: string;
  complement?: string;
  reference?: string;
}

export interface OrderEvent {
  id: string;
  code: string;
  correlationId: string;
  createdAt: string;
  orderId: string;
  fullCode: string;
  metadata?: Record<string, any>;
}

export interface PollingResponse {
  success: boolean;
  data?: Order[];
  message?: string;
  error?: string;
}

export interface PollingEvent {
  id: string;
  code: string;
  correlationId: string;
  createdAt: string;
  orderId: string;
  fullCode: string;
  metadata?: Record<string, any>;
}

export interface EventEntity {
  id: string;
  event_id: string;
  correlation_id: string;
  code: string;
  full_code: string;
  order_id: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface AcknowledgmentRequest {
  eventId: string;
  orderId: string;
}

export interface AcknowledgmentResponse {
  success: boolean;
  eventId: string;
  acknowledged: boolean;
  error?: string;
}

export interface AcknowledgmentResult {
  success: boolean;
  acknowledgedCount: number;
  failedCount: number;
  errors: string[];
  data?: any;
  error?: string;
}

export interface AcknowledgmentBatch {
  events: AcknowledgmentRequest[];
  timestamp: string;
}

export interface BatchStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: any;
}

export interface OrderServiceConfig {
  pollingInterval: number;
  pollingIntervalMs?: number;
  batchSize: number;
  maxRetries: number;
  timeout: number;
  acknowledgmentRetryAttempts?: number;
  acknowledgmentTimeoutMs?: number;
  maxRequestsPerMinute?: number;
  acknowledgmentRetryDelayMs?: number;
  enableAutoRetry?: boolean;
}

export interface PollingRequest {
  merchantId: string;
  page?: number;
  size?: number;
}

export interface PollingResult {
  success: boolean;
  orders: Order[];
  events: PollingEvent[];
  hasMore: boolean;
  nextPage?: number;
}

export interface PollingServiceState {
  isPolling: boolean;
  lastPollTime?: string;
  errorCount: number;
  successCount: number;
}

export interface PollingLogEntity {
  id: string;
  merchant_id: string;
  poll_time: string;
  orders_found: number;
  events_processed: number;
  success: boolean;
  error_message?: string;
}

export interface TimingMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  durationMs?: number;
  checkpoints: Record<string, number>;
}

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  avgApiResponseTime?: number;
  acknowledgmentRate?: number;
  pollingAccuracy?: number;
  memoryUsageMB?: number;
  errorRate?: number;
  timing: TimingMetrics;
}
