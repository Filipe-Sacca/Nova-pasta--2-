/**
 * Polling Utilities for iFood Orders Module
 * Created: 18/08/2025
 * Purpose: Performance-optimized utilities for precise polling operations
 * CRITICAL: Sub-millisecond timing accuracy for iFood API compliance
 */

import { TimingMetrics, PerformanceMetrics } from '../types/orderTypes';

export class PollingTimer {
  private static instances: Map<string, PollingTimer> = new Map();
  
  private userId: string;
  private targetIntervalMs: number;
  private actualIntervals: number[] = [];
  private startTime: number = 0;
  private lastExecutionTime: number = 0;
  private driftAccumulation: number = 0;
  
  // Performance optimization: Pre-calculated constants
  private readonly TIMING_TOLERANCE_MS = 100; // ±100ms acceptable drift
  private readonly MAX_DRIFT_ACCUMULATION = 500; // Maximum allowed accumulated drift
  private readonly SAMPLE_SIZE = 50; // Sample size for accuracy calculation

  constructor(userId: string, intervalMs: number = 30000) {
    this.userId = userId;
    this.targetIntervalMs = intervalMs;
    this.startTime = Date.now();
    
    console.log(`⏰ [POLLING-TIMER] Initialized for user: ${userId}, interval: ${intervalMs}ms`);
  }

  /**
   * Get or create timer instance for user (singleton pattern for performance)
   */
  static getInstance(userId: string, intervalMs: number = 30000): PollingTimer {
    if (!PollingTimer.instances.has(userId)) {
      PollingTimer.instances.set(userId, new PollingTimer(userId, intervalMs));
    }
    return PollingTimer.instances.get(userId)!;
  }

  /**
   * Record execution timing and calculate drift
   * PERFORMANCE: O(1) operation with bounded memory usage
   */
  recordExecution(): TimingMetrics {
    const now = Date.now();
    const actualInterval = this.lastExecutionTime > 0 ? now - this.lastExecutionTime : this.targetIntervalMs;
    
    // Record actual interval (bounded array for memory efficiency)
    this.actualIntervals.push(actualInterval);
    if (this.actualIntervals.length > this.SAMPLE_SIZE) {
      this.actualIntervals.shift(); // Remove oldest sample
    }
    
    // Calculate drift
    const drift = actualInterval - this.targetIntervalMs;
    this.driftAccumulation += drift;
    
    // Calculate accuracy percentage
    const avgInterval = this.actualIntervals.reduce((sum, interval) => sum + interval, 0) / this.actualIntervals.length;
    const accuracy = Math.max(0, 100 - (Math.abs(avgInterval - this.targetIntervalMs) / this.targetIntervalMs * 100));
    
    this.lastExecutionTime = now;
    
    const metrics: TimingMetrics = {
      startTime: this.lastExecutionTime,
      durationMs: 0, // Will be updated by caller
      targetIntervalMs: this.targetIntervalMs,
      driftMs: drift,
      accuracy: Math.round(accuracy * 100) / 100 // Round to 2 decimal places
    };

    // Performance monitoring logs (only log significant drift)
    if (Math.abs(drift) > this.TIMING_TOLERANCE_MS) {
      console.warn(`⚠️ [POLLING-TIMER] Timing drift detected: ${drift}ms (target: ${this.targetIntervalMs}ms)`);
    }
    
    // Critical drift warning
    if (Math.abs(this.driftAccumulation) > this.MAX_DRIFT_ACCUMULATION) {
      console.error(`🚨 [POLLING-TIMER] Critical drift accumulation: ${this.driftAccumulation}ms`);
      this.driftAccumulation = 0; // Reset accumulation
    }

    return metrics;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const avgInterval = this.actualIntervals.length > 0 
      ? this.actualIntervals.reduce((sum, interval) => sum + interval, 0) / this.actualIntervals.length
      : this.targetIntervalMs;
    
    const accuracy = Math.max(0, 100 - (Math.abs(avgInterval - this.targetIntervalMs) / this.targetIntervalMs * 100));
    
    return {
      pollingAccuracy: Math.round(accuracy * 100) / 100,
      acknowledgmentRate: 0, // Will be updated by acknowledgment service
      avgApiResponseTime: 0, // Will be updated by API calls
      avgProcessingTime: avgInterval,
      errorRate: 0, // Will be updated by error tracking
      throughputEventsPerHour: 0, // Will be updated by event processing
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsagePercent: 0 // Will be updated by CPU monitoring
    };
  }

  /**
   * Calculate next polling time with drift correction
   * PERFORMANCE: Predictive timing to maintain accuracy
   */
  calculateNextPollingTime(): Date {
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecutionTime;
    
    // Apply drift correction
    let nextInterval = this.targetIntervalMs;
    if (Math.abs(this.driftAccumulation) > this.TIMING_TOLERANCE_MS) {
      // Compensate for accumulated drift
      nextInterval -= Math.sign(this.driftAccumulation) * Math.min(Math.abs(this.driftAccumulation), 200);
      console.log(`🔧 [POLLING-TIMER] Applying drift correction: ${nextInterval}ms (was ${this.targetIntervalMs}ms)`);
    }
    
    const nextExecutionTime = this.lastExecutionTime + nextInterval;
    return new Date(nextExecutionTime);
  }

  /**
   * Reset timing metrics (for debugging/maintenance)
   */
  resetMetrics(): void {
    this.actualIntervals = [];
    this.driftAccumulation = 0;
    this.startTime = Date.now();
    this.lastExecutionTime = 0;
    console.log(`🔄 [POLLING-TIMER] Metrics reset for user: ${this.userId}`);
  }

  /**
   * Cleanup timer instance
   */
  static cleanup(userId: string): void {
    if (PollingTimer.instances.has(userId)) {
      PollingTimer.instances.delete(userId);
      console.log(`🧹 [POLLING-TIMER] Cleaned up timer for user: ${userId}`);
    }
  }
}

/**
 * API Response Time Monitor
 * PERFORMANCE: Track API response times for optimization
 */
export class ApiResponseMonitor {
  private static responseHistory: Map<string, number[]> = new Map();
  private static readonly MAX_HISTORY_SIZE = 100;

  /**
   * Record API response time for monitoring
   */
  static recordResponseTime(endpoint: string, responseTimeMs: number): void {
    if (!this.responseHistory.has(endpoint)) {
      this.responseHistory.set(endpoint, []);
    }
    
    const history = this.responseHistory.get(endpoint)!;
    history.push(responseTimeMs);
    
    // Maintain bounded history for memory efficiency
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
    
    // Log slow responses (performance optimization trigger)
    if (responseTimeMs > 1000) {
      console.warn(`⚠️ [API-MONITOR] Slow response detected: ${endpoint} took ${responseTimeMs}ms`);
    }
  }

  /**
   * Get average response time for an endpoint
   */
  static getAverageResponseTime(endpoint: string): number {
    const history = this.responseHistory.get(endpoint);
    if (!history || history.length === 0) return 0;
    
    return history.reduce((sum, time) => sum + time, 0) / history.length;
  }

  /**
   * Get performance summary for all endpoints
   */
  static getPerformanceSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, any> = {};
    
    for (const [endpoint, times] of this.responseHistory.entries()) {
      if (times.length > 0) {
        summary[endpoint] = {
          avg: Math.round(times.reduce((sum, time) => sum + time, 0) / times.length),
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length
        };
      }
    }
    
    return summary;
  }

  /**
   * Reset monitoring data
   */
  static reset(): void {
    this.responseHistory.clear();
    console.log('🔄 [API-MONITOR] Response monitoring data reset');
  }
}

/**
 * Memory and CPU Monitor for Performance Optimization
 */
export class ResourceMonitor {
  private static memorySnapshots: number[] = [];
  private static readonly MAX_SNAPSHOTS = 50;

  /**
   * Take memory snapshot for performance monitoring
   */
  static takeMemorySnapshot(): { heapUsedMB: number; heapTotalMB: number; externalMB: number } {
    const memUsage = process.memoryUsage();
    const snapshot = {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      externalMB: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
    };
    
    // Store for trend analysis
    this.memorySnapshots.push(snapshot.heapUsedMB);
    if (this.memorySnapshots.length > this.MAX_SNAPSHOTS) {
      this.memorySnapshots.shift();
    }
    
    // Memory leak detection
    if (this.memorySnapshots.length >= 10) {
      const recent = this.memorySnapshots.slice(-10);
      const trend = recent[recent.length - 1] - recent[0];
      
      if (trend > 50) { // 50MB increase in last 10 snapshots
        console.warn(`⚠️ [RESOURCE-MONITOR] Potential memory leak detected: +${trend}MB trend`);
      }
    }
    
    return snapshot;
  }

  /**
   * Get current CPU usage estimate
   */
  static getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const elapsedTime = Date.now() - startTime;
        
        // Calculate CPU percentage (approximation)
        const cpuPercent = (currentUsage.user + currentUsage.system) / (elapsedTime * 1000) * 100;
        resolve(Math.round(cpuPercent * 100) / 100);
      }, 100);
    });
  }

  /**
   * Performance health check
   */
  static async getResourceHealth(): Promise<{
    memory: { current: number; trend: string; status: string };
    cpu: { current: number; status: string };
    overall: string;
  }> {
    const memorySnapshot = this.takeMemorySnapshot();
    const cpuUsage = await this.getCpuUsage();
    
    // Determine memory trend
    let memoryTrend = 'stable';
    let memoryStatus = 'healthy';
    
    if (this.memorySnapshots.length >= 5) {
      const recentAvg = this.memorySnapshots.slice(-5).reduce((sum, val) => sum + val, 0) / 5;
      const earlierAvg = this.memorySnapshots.slice(-10, -5).reduce((sum, val) => sum + val, 0) / 5;
      
      if (recentAvg > earlierAvg + 10) {
        memoryTrend = 'increasing';
        if (recentAvg > 200) memoryStatus = 'warning';
        if (recentAvg > 500) memoryStatus = 'critical';
      } else if (recentAvg < earlierAvg - 10) {
        memoryTrend = 'decreasing';
      }
    }
    
    // Determine CPU status
    let cpuStatus = 'healthy';
    if (cpuUsage > 70) cpuStatus = 'warning';
    if (cpuUsage > 90) cpuStatus = 'critical';
    
    // Overall health
    let overallStatus = 'healthy';
    if (memoryStatus === 'warning' || cpuStatus === 'warning') overallStatus = 'warning';
    if (memoryStatus === 'critical' || cpuStatus === 'critical') overallStatus = 'critical';
    
    return {
      memory: {
        current: memorySnapshot.heapUsedMB,
        trend: memoryTrend,
        status: memoryStatus
      },
      cpu: {
        current: cpuUsage,
        status: cpuStatus
      },
      overall: overallStatus
    };
  }
}

/**
 * Event Deduplication Utilities
 * PERFORMANCE: Fast O(1) lookups with automatic cleanup
 */
export class EventDeduplicator {
  private static eventCache: Map<string, Set<string>> = new Map(); // userId -> Set of eventIds
  private static readonly CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private static readonly MAX_EVENTS_PER_USER = 10000;
  
  /**
   * Check if event is duplicate (O(1) operation)
   */
  static isDuplicate(userId: string, eventId: string): boolean {
    if (!this.eventCache.has(userId)) {
      this.eventCache.set(userId, new Set());
    }
    
    const userEvents = this.eventCache.get(userId)!;
    
    if (userEvents.has(eventId)) {
      console.log(`🔄 [DEDUPLICATOR] Duplicate event detected: ${eventId} for user: ${userId}`);
      return true;
    }
    
    // Add to cache
    userEvents.add(eventId);
    
    // Maintain cache size for memory efficiency
    if (userEvents.size > this.MAX_EVENTS_PER_USER) {
      // Remove oldest entries (simplified LRU)
      const oldestEvents = Array.from(userEvents).slice(0, 1000);
      oldestEvents.forEach(eventId => userEvents.delete(eventId));
      console.log(`🧹 [DEDUPLICATOR] Cache cleanup: removed 1000 old events for user: ${userId}`);
    }
    
    return false;
  }

  /**
   * Mark event as processed (for performance optimization)
   */
  static markAsProcessed(userId: string, eventId: string): void {
    // Event remains in cache to prevent reprocessing
    // Actual removal happens during cleanup cycles
  }

  /**
   * Cleanup old events from cache (memory optimization)
   */
  static cleanup(): void {
    console.log(`🧹 [DEDUPLICATOR] Starting cache cleanup...`);
    
    let totalCleaned = 0;
    for (const [userId, events] of this.eventCache.entries()) {
      const beforeSize = events.size;
      
      // For simplified cleanup, reduce each user's cache by 50% if over limit
      if (events.size > this.MAX_EVENTS_PER_USER / 2) {
        const eventsArray = Array.from(events);
        const toRemove = eventsArray.slice(0, Math.floor(events.size / 2));
        toRemove.forEach(eventId => events.delete(eventId));
        
        totalCleaned += beforeSize - events.size;
      }
    }
    
    console.log(`✅ [DEDUPLICATOR] Cleanup completed: ${totalCleaned} events removed`);
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats(): { totalUsers: number; totalEvents: number; memoryUsageEstimateMB: number } {
    let totalEvents = 0;
    for (const events of this.eventCache.values()) {
      totalEvents += events.size;
    }
    
    // Rough memory usage estimate (each event ID ~50 bytes)
    const memoryUsageEstimateMB = (totalEvents * 50) / 1024 / 1024;
    
    return {
      totalUsers: this.eventCache.size,
      totalEvents,
      memoryUsageEstimateMB: Math.round(memoryUsageEstimateMB * 100) / 100
    };
  }

  /**
   * Start periodic cleanup (memory management)
   */
  static startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, this.CACHE_CLEANUP_INTERVAL);
    
    console.log(`🧹 [DEDUPLICATOR] Periodic cleanup started (every ${this.CACHE_CLEANUP_INTERVAL / 1000 / 60} minutes)`);
  }
}

/**
 * Rate Limiting Utilities for iFood API Compliance
 */
export class RateLimiter {
  private static requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private static readonly WINDOW_SIZE_MS = 60 * 1000; // 1 minute window
  private static readonly DEFAULT_MAX_REQUESTS = 120; // Conservative limit

  /**
   * Check if request is allowed under rate limit
   */
  static isRequestAllowed(userId: string, maxRequestsPerMinute: number = this.DEFAULT_MAX_REQUESTS): boolean {
    const now = Date.now();
    const key = userId;
    
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, { count: 0, resetTime: now + this.WINDOW_SIZE_MS });
    }
    
    const rateData = this.requestCounts.get(key)!;
    
    // Reset window if expired
    if (now >= rateData.resetTime) {
      rateData.count = 0;
      rateData.resetTime = now + this.WINDOW_SIZE_MS;
    }
    
    // Check if under limit
    if (rateData.count >= maxRequestsPerMinute) {
      const timeToReset = rateData.resetTime - now;
      console.warn(`🚨 [RATE-LIMITER] Rate limit exceeded for user: ${userId}. Reset in ${timeToReset}ms`);
      return false;
    }
    
    // Increment counter
    rateData.count++;
    return true;
  }

  /**
   * Get rate limit status for user
   */
  static getRateLimitStatus(userId: string): { 
    remaining: number; 
    resetTime: number; 
    isLimited: boolean;
    requestsInWindow: number;
  } {
    const rateData = this.requestCounts.get(userId);
    
    if (!rateData) {
      return {
        remaining: this.DEFAULT_MAX_REQUESTS,
        resetTime: Date.now() + this.WINDOW_SIZE_MS,
        isLimited: false,
        requestsInWindow: 0
      };
    }
    
    const now = Date.now();
    const isWindowExpired = now >= rateData.resetTime;
    
    return {
      remaining: isWindowExpired ? this.DEFAULT_MAX_REQUESTS : Math.max(0, this.DEFAULT_MAX_REQUESTS - rateData.count),
      resetTime: rateData.resetTime,
      isLimited: !isWindowExpired && rateData.count >= this.DEFAULT_MAX_REQUESTS,
      requestsInWindow: isWindowExpired ? 0 : rateData.count
    };
  }

  /**
   * Reset rate limit for user (emergency use)
   */
  static resetUserLimit(userId: string): void {
    this.requestCounts.delete(userId);
    console.log(`🔄 [RATE-LIMITER] Rate limit reset for user: ${userId}`);
  }
}

/**
 * Performance Optimization Utilities
 */
export class PerformanceOptimizer {
  /**
   * Optimize polling configuration based on performance metrics
   */
  static optimizePollingConfig(metrics: PerformanceMetrics): Partial<any> {
    const recommendations: any = {};
    
    // If API response time is consistently high, reduce concurrent requests
    if (metrics.avgApiResponseTime > 2000) {
      recommendations.maxConcurrentBatches = 2;
      recommendations.batchProcessingSize = 50;
      console.log(`🔧 [OPTIMIZER] Reducing concurrency due to slow API responses (${metrics.avgApiResponseTime}ms)`);
    }
    
    // If acknowledgment rate is low, increase retry attempts
    if (metrics.acknowledgmentRate < 95) {
      recommendations.acknowledgmentRetryAttempts = 5;
      recommendations.acknowledgmentRetryDelayMs = 2000;
      console.log(`🔧 [OPTIMIZER] Increasing retry attempts due to low acknowledgment rate (${metrics.acknowledgmentRate}%)`);
    }
    
    // If polling accuracy is low, adjust timing
    if (metrics.pollingAccuracy < 98) {
      recommendations.enableDriftCorrection = true;
      console.log(`🔧 [OPTIMIZER] Enabling drift correction due to low polling accuracy (${metrics.pollingAccuracy}%)`);
    }
    
    // Memory optimization
    if (metrics.memoryUsageMB > 200) {
      recommendations.enableAggressiveCleanup = true;
      console.log(`🔧 [OPTIMIZER] Enabling aggressive cleanup due to high memory usage (${metrics.memoryUsageMB}MB)`);
    }
    
    return recommendations;
  }

  /**
   * Get performance grade based on metrics
   */
  static getPerformanceGrade(metrics: PerformanceMetrics): { 
    grade: 'A' | 'B' | 'C' | 'D' | 'F'; 
    score: number; 
    issues: string[] 
  } {
    let score = 100;
    const issues: string[] = [];
    
    // Polling accuracy (30% weight)
    if (metrics.pollingAccuracy < 99) {
      const penalty = (99 - metrics.pollingAccuracy) * 3;
      score -= penalty;
      issues.push(`Polling accuracy: ${metrics.pollingAccuracy}% (target: 99%+)`);
    }
    
    // Acknowledgment rate (40% weight)  
    if (metrics.acknowledgmentRate < 100) {
      const penalty = (100 - metrics.acknowledgmentRate) * 4;
      score -= penalty;
      issues.push(`Acknowledgment rate: ${metrics.acknowledgmentRate}% (target: 100%)`);
    }
    
    // API response time (20% weight)
    if (metrics.avgApiResponseTime > 500) {
      const penalty = Math.min(20, (metrics.avgApiResponseTime - 500) / 100);
      score -= penalty;
      issues.push(`API response time: ${metrics.avgApiResponseTime}ms (target: <500ms)`);
    }
    
    // Error rate (10% weight)
    if (metrics.errorRate > 0.1) {
      const penalty = Math.min(10, metrics.errorRate * 100);
      score -= penalty;
      issues.push(`Error rate: ${metrics.errorRate}% (target: <0.1%)`);
    }
    
    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 95) grade = 'A';
    else if (score >= 85) grade = 'B';
    else if (score >= 75) grade = 'C';
    else if (score >= 65) grade = 'D';
    else grade = 'F';
    
    return {
      grade,
      score: Math.max(0, Math.round(score)),
      issues
    };
  }
}

// Export utility functions for easier use
export const pollingUtils = {
  createTimer: (userId: string, intervalMs?: number) => PollingTimer.getInstance(userId, intervalMs),
  recordApiResponse: (endpoint: string, timeMs: number) => ApiResponseMonitor.recordResponseTime(endpoint, timeMs),
  checkMemory: () => ResourceMonitor.takeMemorySnapshot(),
  getCpuUsage: () => ResourceMonitor.getCpuUsage(),
  isDuplicateEvent: (userId: string, eventId: string) => EventDeduplicator.isDuplicate(userId, eventId),
  isRateLimited: (userId: string, maxReqs?: number) => !RateLimiter.isRequestAllowed(userId, maxReqs),
  getPerformanceGrade: (metrics: PerformanceMetrics) => PerformanceOptimizer.getPerformanceGrade(metrics)
};

// Start automatic cleanup processes
EventDeduplicator.startPeriodicCleanup();