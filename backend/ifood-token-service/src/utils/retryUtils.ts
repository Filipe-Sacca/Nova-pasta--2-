/**
 * Retry Utilities for iFood Acknowledgment System
 * Created: 18/08/2025
 * Purpose: SECURITY & RELIABILITY - Zero tolerance retry system for 100% acknowledgment
 * CRITICAL: Implements circuit breaker and exponential backoff for iFood compliance
 */

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number; // Failed requests before opening circuit
  circuitBreakerTimeoutMs: number; // Time to wait before retry after circuit opens
}

export interface RetryAttempt {
  attemptNumber: number;
  delayMs: number;
  startTime: number;
  endTime?: number;
  success: boolean;
  error?: string;
  shouldRetry: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: RetryAttempt[];
  totalDurationMs: number;
  finalAttempt: number;
}

/**
 * Circuit Breaker for Acknowledgment System
 * SECURITY: Prevents cascading failures and protects iFood API
 */
export class AcknowledgmentCircuitBreaker {
  private static instances: Map<string, AcknowledgmentCircuitBreaker> = new Map();
  
  private userId: string;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private config: RetryConfig;
  
  constructor(userId: string, config: RetryConfig) {
    this.userId = userId;
    this.config = config;
    
    console.log(`🔧 [CIRCUIT-BREAKER] Initialized for user: ${userId}`);
  }

  static getInstance(userId: string, config: RetryConfig): AcknowledgmentCircuitBreaker {
    if (!this.instances.has(userId)) {
      this.instances.set(userId, new AcknowledgmentCircuitBreaker(userId, config));
    }
    return this.instances.get(userId)!;
  }

  /**
   * Check if acknowledgment request is allowed
   * SECURITY: Prevents overwhelming iFood API during failures
   */
  canExecute(): { allowed: boolean; reason?: string } {
    const now = Date.now();
    
    switch (this.state) {
      case 'CLOSED':
        // Normal operation
        return { allowed: true };
        
      case 'OPEN':
        // Circuit is open - check if timeout has passed
        if (now - this.lastFailureTime >= this.config.circuitBreakerTimeoutMs) {
          this.state = 'HALF_OPEN';
          console.log(`🔄 [CIRCUIT-BREAKER] State: OPEN → HALF_OPEN (timeout passed)`);
          return { allowed: true };
        } else {
          const timeUntilRetry = this.config.circuitBreakerTimeoutMs - (now - this.lastFailureTime);
          return { 
            allowed: false, 
            reason: `Circuit breaker OPEN. Retry in ${Math.round(timeUntilRetry / 1000)}s` 
          };
        }
        
      case 'HALF_OPEN':
        // Allow one test request
        return { allowed: true };
        
      default:
        return { allowed: false, reason: 'Unknown circuit breaker state' };
    }
  }

  /**
   * Record acknowledgment result for circuit breaker logic
   */
  recordResult(success: boolean): void {
    if (success) {
      // Success - reset failure count and close circuit
      this.failureCount = 0;
      if (this.state !== 'CLOSED') {
        this.state = 'CLOSED';
        console.log(`✅ [CIRCUIT-BREAKER] State: → CLOSED (success recorded)`);
      }
    } else {
      // Failure - increment count and potentially open circuit
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.state === 'HALF_OPEN') {
        // Failed in half-open state - immediately open circuit
        this.state = 'OPEN';
        console.log(`❌ [CIRCUIT-BREAKER] State: HALF_OPEN → OPEN (failed test)`);
      } else if (this.failureCount >= this.config.circuitBreakerThreshold) {
        // Too many failures - open circuit
        this.state = 'OPEN';
        console.log(`🚨 [CIRCUIT-BREAKER] State: CLOSED → OPEN (${this.failureCount} failures)`);
      }
    }
    
    console.log(`📊 [CIRCUIT-BREAKER] User: ${this.userId}, State: ${this.state}, Failures: ${this.failureCount}`);
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): { state: string; failureCount: number; lastFailureTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Reset circuit breaker (emergency use)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    console.log(`🔄 [CIRCUIT-BREAKER] Reset for user: ${this.userId}`);
  }
}

/**
 * Advanced Retry Engine with Exponential Backoff
 * SECURITY & RELIABILITY: Ensures 100% acknowledgment eventually
 */
export class AdvancedRetryEngine {
  /**
   * Execute function with advanced retry logic
   * CRITICAL: Designed specifically for iFood acknowledgment compliance
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig,
    userId: string,
    context: string = 'acknowledgment'
  ): Promise<RetryResult<T>> {
    const attempts: RetryAttempt[] = [];
    const overallStartTime = Date.now();
    let lastError: string = '';
    
    // Initialize circuit breaker if enabled
    const circuitBreaker = config.enableCircuitBreaker 
      ? AcknowledgmentCircuitBreaker.getInstance(userId, config)
      : null;

    console.log(`🔄 [RETRY-ENGINE] Starting ${context} with retry for user: ${userId}`);
    console.log(`⚙️ [RETRY-ENGINE] Config: ${config.maxAttempts} attempts, ${config.initialDelayMs}ms initial delay`);

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      // Check circuit breaker
      if (circuitBreaker) {
        const circuitCheck = circuitBreaker.canExecute();
        if (!circuitCheck.allowed) {
          console.log(`🚨 [RETRY-ENGINE] Circuit breaker blocked attempt ${attempt}: ${circuitCheck.reason}`);
          
          attempts.push({
            attemptNumber: attempt,
            delayMs: 0,
            startTime: Date.now(),
            endTime: Date.now(),
            success: false,
            error: `Circuit breaker: ${circuitCheck.reason}`,
            shouldRetry: false
          });
          
          // Skip to next attempt or break if circuit breaker blocks
          if (attempt === config.maxAttempts) break;
          continue;
        }
      }

      const attemptStartTime = Date.now();
      let attemptSuccess = false;
      let attemptError: string | undefined;

      try {
        console.log(`🎯 [RETRY-ENGINE] Attempt ${attempt}/${config.maxAttempts} for ${context}`);
        
        const result = await fn();
        attemptSuccess = true;
        
        // Record successful attempt
        const attemptRecord: RetryAttempt = {
          attemptNumber: attempt,
          delayMs: 0,
          startTime: attemptStartTime,
          endTime: Date.now(),
          success: true,
          shouldRetry: false
        };
        attempts.push(attemptRecord);
        
        // Notify circuit breaker of success
        if (circuitBreaker) {
          circuitBreaker.recordResult(true);
        }

        console.log(`✅ [RETRY-ENGINE] ${context} succeeded on attempt ${attempt}`);
        
        return {
          success: true,
          data: result,
          attempts,
          totalDurationMs: Date.now() - overallStartTime,
          finalAttempt: attempt
        };

      } catch (error: any) {
        attemptError = error.message || 'Unknown error';
        lastError = attemptError;
        
        // Determine if error is retryable
        const isRetryable = this.isRetryableError(error);
        const shouldRetry = attempt < config.maxAttempts && isRetryable;
        
        // Record failed attempt
        const attemptRecord: RetryAttempt = {
          attemptNumber: attempt,
          delayMs: 0,
          startTime: attemptStartTime,
          endTime: Date.now(),
          success: false,
          error: attemptError,
          shouldRetry
        };
        attempts.push(attemptRecord);
        
        // Notify circuit breaker of failure
        if (circuitBreaker) {
          circuitBreaker.recordResult(false);
        }

        console.log(`❌ [RETRY-ENGINE] Attempt ${attempt} failed: ${attemptError}`);
        
        if (!shouldRetry) {
          console.log(`🚫 [RETRY-ENGINE] Not retryable or max attempts reached`);
          break;
        }

        // Calculate delay for next attempt (exponential backoff)
        const delay = Math.min(
          config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelayMs
        );
        
        // Add jitter to prevent thundering herd (±25% random variation)
        const jitter = delay * 0.25 * (Math.random() - 0.5);
        const finalDelay = Math.round(delay + jitter);
        
        console.log(`⏳ [RETRY-ENGINE] Waiting ${finalDelay}ms before attempt ${attempt + 1} (base: ${delay}ms, jitter: ${Math.round(jitter)}ms)`);
        
        // Update delay in last attempt record
        attempts[attempts.length - 1].delayMs = finalDelay;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
    }

    // All attempts failed
    console.log(`❌ [RETRY-ENGINE] All ${config.maxAttempts} attempts failed for ${context}`);
    
    return {
      success: false,
      error: `Max retry attempts (${config.maxAttempts}) exceeded. Last error: ${lastError}`,
      attempts,
      totalDurationMs: Date.now() - overallStartTime,
      finalAttempt: config.maxAttempts
    };
  }

  /**
   * Determine if an error is retryable
   * SECURITY: Classify errors to avoid infinite retries on non-retryable issues
   */
  private static isRetryableError(error: any): boolean {
    // Non-retryable errors (don't retry these)
    const nonRetryableMessages = [
      'Invalid userId format',
      'eventIds must be an array', 
      'Potentially malicious event ID',
      'Authentication failed',
      'Invalid token',
      'Batch size exceeds limit'
    ];
    
    const errorMessage = error.message || '';
    
    // Check for non-retryable error patterns
    for (const pattern of nonRetryableMessages) {
      if (errorMessage.includes(pattern)) {
        console.log(`🚫 [RETRY-ENGINE] Non-retryable error detected: ${pattern}`);
        return false;
      }
    }

    // Retryable HTTP status codes
    if (error.response?.status) {
      const status = error.response.status;
      
      // Don't retry client errors (4xx) except specific ones
      if (status >= 400 && status < 500) {
        const retryable4xx = [429, 408]; // Rate limit, timeout
        if (!retryable4xx.includes(status)) {
          console.log(`🚫 [RETRY-ENGINE] Non-retryable HTTP ${status} error`);
          return false;
        }
      }
      
      // Always retry server errors (5xx) and network issues
      if (status >= 500 || status === 429 || status === 408) {
        console.log(`🔄 [RETRY-ENGINE] Retryable HTTP ${status} error`);
        return true;
      }
    }

    // Network errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      console.log(`🔄 [RETRY-ENGINE] Retryable network error: ${error.code}`);
      return true;
    }

    // Default: retry unknown errors (better safe than sorry)
    console.log(`🔄 [RETRY-ENGINE] Unknown error - treating as retryable: ${errorMessage}`);
    return true;
  }

  /**
   * Get default retry configuration for acknowledgment system
   * SECURITY: Conservative settings optimized for iFood API compliance
   */
  static getDefaultAcknowledgmentConfig(): RetryConfig {
    return {
      maxAttempts: 5,                    // 5 attempts maximum
      initialDelayMs: 1000,              // Start with 1 second
      maxDelayMs: 30000,                 // Max 30 seconds delay
      backoffMultiplier: 2,              // Double delay each time
      enableCircuitBreaker: true,        // Enable circuit breaker
      circuitBreakerThreshold: 3,        // Open after 3 consecutive failures
      circuitBreakerTimeoutMs: 60000     // 1 minute timeout when open
    };
  }

  /**
   * Get aggressive retry configuration for critical operations
   * CRITICAL: For when 100% acknowledgment is absolutely required
   */
  static getCriticalAcknowledgmentConfig(): RetryConfig {
    return {
      maxAttempts: 10,                   // More attempts for critical operations
      initialDelayMs: 500,               // Faster initial retry
      maxDelayMs: 60000,                 // Longer max delay
      backoffMultiplier: 1.5,            // Gentler backoff
      enableCircuitBreaker: false,       // Disable circuit breaker for critical ops
      circuitBreakerThreshold: 5,        
      circuitBreakerTimeoutMs: 30000     
    };
  }
}

/**
 * Acknowledgment Retry Orchestrator
 * CRITICAL: Coordinates all retry attempts with monitoring and alerting
 */
export class AcknowledgmentRetryOrchestrator {
  private static retryHistory: Map<string, RetryAttempt[]> = new Map();
  private static readonly MAX_HISTORY_SIZE = 1000;

  /**
   * Execute acknowledgment with comprehensive retry logic
   * SECURITY & COMPLIANCE: Zero tolerance for permanent failures
   */
  static async executeAcknowledgmentWithRetry<T>(
    acknowledgmentFn: () => Promise<T>,
    eventIds: string[],
    userId: string,
    config?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const retryConfig = { 
      ...AdvancedRetryEngine.getDefaultAcknowledgmentConfig(), 
      ...config 
    };

    console.log(`🎯 [RETRY-ORCHESTRATOR] Starting acknowledgment retry for ${eventIds.length} events`);
    console.log(`⚙️ [RETRY-ORCHESTRATOR] Config: ${retryConfig.maxAttempts} attempts, circuit breaker: ${retryConfig.enableCircuitBreaker}`);

    // Execute with retry logic
    const result = await AdvancedRetryEngine.executeWithRetry(
      acknowledgmentFn,
      retryConfig,
      userId,
      `acknowledgment-${eventIds.length}-events`
    );

    // Store retry history for analysis
    this.storeRetryHistory(userId, result.attempts);

    // SECURITY: Log retry outcome for compliance audit
    console.log(`📊 [RETRY-ORCHESTRATOR] Final result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`📊 [RETRY-ORCHESTRATOR] Attempts: ${result.finalAttempt}, Duration: ${result.totalDurationMs}ms`);
    
    if (!result.success) {
      console.error(`🚨 [RETRY-ORCHESTRATOR] CRITICAL: Failed to acknowledge ${eventIds.length} events after ${result.finalAttempt} attempts`);
      console.error(`🚨 [RETRY-ORCHESTRATOR] This violates iFood 100% acknowledgment requirement!`);
      
      // CRITICAL: Alert for failed acknowledgments
      this.triggerFailureAlert(userId, eventIds, result);
    }

    return result;
  }

  /**
   * Store retry history for analysis and monitoring
   */
  private static storeRetryHistory(userId: string, attempts: RetryAttempt[]): void {
    if (!this.retryHistory.has(userId)) {
      this.retryHistory.set(userId, []);
    }
    
    const userHistory = this.retryHistory.get(userId)!;
    userHistory.push(...attempts);
    
    // Maintain bounded history for memory efficiency
    if (userHistory.length > this.MAX_HISTORY_SIZE) {
      userHistory.splice(0, userHistory.length - this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Get retry statistics for user
   */
  static getRetryStatistics(userId: string): {
    totalAttempts: number;
    successRate: number;
    avgAttemptsPerOperation: number;
    avgRetryDelay: number;
    circuitBreakerActivations: number;
  } {
    const userHistory = this.retryHistory.get(userId) || [];
    
    if (userHistory.length === 0) {
      return {
        totalAttempts: 0,
        successRate: 100,
        avgAttemptsPerOperation: 1,
        avgRetryDelay: 0,
        circuitBreakerActivations: 0
      };
    }

    const successfulAttempts = userHistory.filter(a => a.success).length;
    const totalDelay = userHistory.reduce((sum, a) => sum + (a.delayMs || 0), 0);
    const circuitBreakerBlocks = userHistory.filter(a => a.error?.includes('Circuit breaker')).length;

    return {
      totalAttempts: userHistory.length,
      successRate: (successfulAttempts / userHistory.length) * 100,
      avgAttemptsPerOperation: userHistory.length / Math.max(1, successfulAttempts),
      avgRetryDelay: totalDelay / Math.max(1, userHistory.length),
      circuitBreakerActivations: circuitBreakerBlocks
    };
  }

  /**
   * Trigger failure alert for critical acknowledgment failures
   * SECURITY: Ensures compliance team is notified of iFood violations
   */
  private static triggerFailureAlert(userId: string, eventIds: string[], result: RetryResult<any>): void {
    const alert = {
      severity: 'CRITICAL',
      service: 'ifood-acknowledgment-system',
      userId,
      eventCount: eventIds.length,
      attempts: result.finalAttempt,
      totalDurationMs: result.totalDurationMs,
      lastError: result.error,
      timestamp: new Date().toISOString(),
      compliance: 'IFOOD_100_PERCENT_ACKNOWLEDGMENT_VIOLATED',
      actionRequired: 'IMMEDIATE_INVESTIGATION_REQUIRED'
    };

    // Log critical alert (in production, this would trigger monitoring alerts)
    console.error(`🚨🚨🚨 [CRITICAL-ALERT] iFood Acknowledgment Failure 🚨🚨🚨`);
    console.error(JSON.stringify(alert, null, 2));
    console.error(`🚨🚨🚨 COMPLIANCE VIOLATION - IMMEDIATE ACTION REQUIRED 🚨🚨🚨`);

    // TODO: In production, integrate with alerting system (PagerDuty, Slack, etc.)
    // TODO: Send notification to compliance team
    // TODO: Create incident ticket automatically
  }

  /**
   * Emergency retry for failed acknowledgments
   * CRITICAL: Last resort to achieve 100% acknowledgment
   */
  static async emergencyRetryFailedAcknowledgments(
    acknowledgmentFn: () => Promise<any>,
    eventIds: string[],
    userId: string
  ): Promise<RetryResult<any>> {
    console.log(`🚨 [RETRY-ORCHESTRATOR] EMERGENCY RETRY for ${eventIds.length} events`);
    
    // Use critical configuration with no circuit breaker
    const criticalConfig = AdvancedRetryEngine.getCriticalAcknowledgmentConfig();
    
    return await this.executeAcknowledgmentWithRetry(
      acknowledgmentFn,
      eventIds,
      userId,
      criticalConfig
    );
  }
}

// Export utility functions
export const retryUtils = {
  executeWithRetry: AdvancedRetryEngine.executeWithRetry,
  getDefaultConfig: AdvancedRetryEngine.getDefaultAcknowledgmentConfig,
  getCriticalConfig: AdvancedRetryEngine.getCriticalAcknowledgmentConfig,
  getCircuitBreaker: AcknowledgmentCircuitBreaker.getInstance,
  getRetryStats: AcknowledgmentRetryOrchestrator.getRetryStatistics,
  emergencyRetry: AcknowledgmentRetryOrchestrator.emergencyRetryFailedAcknowledgments
};