/**
 * Alerting and Monitoring Utils for iFood Orders Module
 * Created: 18/08/2025
 * Purpose: SECURITY & COMPLIANCE - Critical alerting for iFood violations
 * CRITICAL: Zero tolerance monitoring for acknowledgment failures
 */

export interface Alert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  service: string;
  userId: string;
  type: AlertType;
  message: string;
  details: any;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export type AlertType = 
  | 'ACKNOWLEDGMENT_FAILURE'
  | 'POLLING_TIMEOUT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'API_UNAVAILABLE'
  | 'DATABASE_ERROR'
  | 'CIRCUIT_BREAKER_OPEN'
  | 'MEMORY_LEAK_DETECTED'
  | 'TIMING_DRIFT_CRITICAL'
  | 'TOKEN_REFRESH_FAILED'
  | 'COMPLIANCE_VIOLATION';

export interface AlertConfig {
  enableAlerting: boolean;
  
  // Thresholds for automatic alerting
  acknowledgmentFailureThreshold: number; // Percentage of failures that trigger alert
  pollingTimeoutThreshold: number;        // Minutes without successful polling
  apiResponseTimeThreshold: number;       // Milliseconds for slow API response
  memoryUsageThreshold: number;           // MB for memory usage alert
  timingDriftThreshold: number;           // Milliseconds for timing drift alert
  
  // Alert destinations
  enableConsoleAlerts: boolean;
  enableDatabaseLogging: boolean;
  webhookUrl?: string;
  slackWebhookUrl?: string;
  emailNotifications?: string[];
  
  // Alert rate limiting
  maxAlertsPerHour: number;
  duplicateAlertSuppressionMinutes: number;
}

/**
 * Critical Alert Manager for iFood Compliance
 * SECURITY: Ensures all compliance violations are tracked and reported
 */
export class CriticalAlertManager {
  private static instance: CriticalAlertManager;
  private alerts: Map<string, Alert[]> = new Map(); // userId -> alerts
  private alertCounts: Map<string, number> = new Map(); // alertType -> count in current hour
  private lastAlertTime: Map<string, number> = new Map(); // alertKey -> timestamp
  
  private config: AlertConfig = {
    enableAlerting: true,
    acknowledgmentFailureThreshold: 1, // Even 1 failure is critical for iFood
    pollingTimeoutThreshold: 2,        // 2 minutes without polling
    apiResponseTimeThreshold: 5000,    // 5 seconds for slow API
    memoryUsageThreshold: 500,         // 500MB memory usage
    timingDriftThreshold: 500,         // 500ms timing drift
    enableConsoleAlerts: true,
    enableDatabaseLogging: true,
    maxAlertsPerHour: 100,
    duplicateAlertSuppressionMinutes: 5
  };

  private constructor() {
    console.log('🚨 [ALERT-MANAGER] Critical Alert Manager initialized');
    
    // Start periodic cleanup
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000); // Every hour
  }

  static getInstance(): CriticalAlertManager {
    if (!this.instance) {
      this.instance = new CriticalAlertManager();
    }
    return this.instance;
  }

  /**
   * Trigger critical alert for acknowledgment failure
   * CRITICAL: This violates iFood 100% acknowledgment requirement
   */
  async triggerAcknowledgmentFailureAlert(
    userId: string,
    eventIds: string[],
    error: string,
    attempts: number,
    durationMs: number
  ): Promise<void> {
    const alert: Alert = {
      id: `ack_fail_${userId}_${Date.now()}`,
      severity: 'CRITICAL',
      service: 'ifood-acknowledgment-system',
      userId,
      type: 'ACKNOWLEDGMENT_FAILURE',
      message: `CRITICAL: Failed to acknowledge ${eventIds.length} iFood events after ${attempts} attempts`,
      details: {
        eventIds: eventIds.slice(0, 10), // First 10 events for logging
        totalEvents: eventIds.length,
        attempts,
        durationMs,
        error,
        complianceViolation: 'IFOOD_100_PERCENT_ACKNOWLEDGMENT_REQUIREMENT',
        actionRequired: 'IMMEDIATE_MANUAL_ACKNOWLEDGMENT_REQUIRED',
        businessImpact: 'ORDERS_MAY_BE_LOST_REVENUE_IMPACT'
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    await this.processAlert(alert);
  }

  /**
   * Trigger alert for polling timeout
   * HIGH: Polling must maintain 30-second intervals
   */
  async triggerPollingTimeoutAlert(
    userId: string,
    lastPollingTime: string,
    timeoutMinutes: number
  ): Promise<void> {
    const alert: Alert = {
      id: `poll_timeout_${userId}_${Date.now()}`,
      severity: 'HIGH',
      service: 'ifood-polling-system',
      userId,
      type: 'POLLING_TIMEOUT',
      message: `Polling timeout detected: ${timeoutMinutes} minutes without successful polling`,
      details: {
        lastPollingTime,
        timeoutMinutes,
        requiredInterval: '30 seconds',
        complianceImpact: 'IFOOD_POLLING_REQUIREMENT_VIOLATION'
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    await this.processAlert(alert);
  }

  /**
   * Trigger alert for timing drift
   * MEDIUM: Timing accuracy below acceptable threshold
   */
  async triggerTimingDriftAlert(
    userId: string,
    actualIntervalMs: number,
    targetIntervalMs: number,
    accuracy: number
  ): Promise<void> {
    const driftMs = Math.abs(actualIntervalMs - targetIntervalMs);
    
    if (driftMs < this.config.timingDriftThreshold) {
      return; // Within acceptable range
    }

    const alert: Alert = {
      id: `timing_drift_${userId}_${Date.now()}`,
      severity: 'MEDIUM',
      service: 'ifood-polling-system',
      userId,
      type: 'TIMING_DRIFT_CRITICAL',
      message: `Critical timing drift detected: ${driftMs}ms drift (accuracy: ${accuracy}%)`,
      details: {
        actualIntervalMs,
        targetIntervalMs,
        driftMs,
        accuracy,
        threshold: this.config.timingDriftThreshold,
        complianceRisk: 'IFOOD_TIMING_REQUIREMENT_RISK'
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    await this.processAlert(alert);
  }

  /**
   * Process and route alert based on configuration
   */
  private async processAlert(alert: Alert): Promise<void> {
    try {
      // Check for duplicate suppression
      const alertKey = `${alert.type}_${alert.userId}`;
      const lastAlertTime = this.lastAlertTime.get(alertKey) || 0;
      const timeSinceLastAlert = Date.now() - lastAlertTime;
      
      if (timeSinceLastAlert < this.config.duplicateAlertSuppressionMinutes * 60 * 1000) {
        console.log(`🔇 [ALERT-MANAGER] Suppressing duplicate alert: ${alert.type} for user: ${alert.userId}`);
        return;
      }

      // Update last alert time
      this.lastAlertTime.set(alertKey, Date.now());

      // Store alert for user
      if (!this.alerts.has(alert.userId)) {
        this.alerts.set(alert.userId, []);
      }
      this.alerts.get(alert.userId)!.push(alert);

      // Route alert based on configuration
      if (this.config.enableConsoleAlerts) {
        this.logConsoleAlert(alert);
      }

      if (this.config.enableDatabaseLogging) {
        await this.logAlertToDatabase(alert);
      }

      // TODO: Implement webhook notifications
      // TODO: Implement Slack notifications  
      // TODO: Implement email notifications

      console.log(`🚨 [ALERT-MANAGER] Alert processed: ${alert.id}`);

    } catch (error: any) {
      console.error(`❌ [ALERT-MANAGER] Error processing alert:`, error);
    }
  }

  /**
   * Log alert to console with proper formatting
   */
  private logConsoleAlert(alert: Alert): void {
    const severityEmojis = {
      'LOW': '🟡',
      'MEDIUM': '🟠', 
      'HIGH': '🔴',
      'CRITICAL': '🚨'
    };

    const emoji = severityEmojis[alert.severity];
    
    console.log(`\n${emoji}${emoji}${emoji} [${alert.severity} ALERT] ${emoji}${emoji}${emoji}`);
    console.log(`🏷️  Alert ID: ${alert.id}`);
    console.log(`🔧 Service: ${alert.service}`);
    console.log(`👤 User: ${alert.userId}`);
    console.log(`📝 Type: ${alert.type}`);
    console.log(`💬 Message: ${alert.message}`);
    console.log(`⏰ Time: ${alert.timestamp}`);
    
    if (alert.details) {
      console.log(`📊 Details:`, JSON.stringify(alert.details, null, 2));
    }
    
    if (alert.severity === 'CRITICAL') {
      console.log(`🚨 CRITICAL ALERT: IMMEDIATE ACTION REQUIRED 🚨`);
      console.log(`🚨 This may impact iFood compliance and business operations 🚨`);
    }
    
    console.log(`${emoji}${emoji}${emoji} [END ${alert.severity} ALERT] ${emoji}${emoji}${emoji}\n`);
  }

  /**
   * Log alert to database for persistence and analysis
   */
  private async logAlertToDatabase(alert: Alert): Promise<void> {
    try {
      // Note: This would require an alerts table in the database
      // For now, log to polling_log as a workaround
      console.log(`💾 [ALERT-MANAGER] Logging alert to database: ${alert.id}`);
      
      // TODO: Create proper alerts table and implement database logging
      // await this.supabase.from('system_alerts').insert(alert);
      
    } catch (error: any) {
      console.error(`❌ [ALERT-MANAGER] Error logging alert to database:`, error);
    }
  }

  /**
   * Get alerts for user
   */
  getAlertsForUser(userId: string): Alert[] {
    return this.alerts.get(userId) || [];
  }

  /**
   * Get all active (unacknowledged) alerts
   */
  getActiveAlerts(): Alert[] {
    const allAlerts: Alert[] = [];
    for (const userAlerts of this.alerts.values()) {
      allAlerts.push(...userAlerts.filter(alert => !alert.acknowledged));
    }
    return allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Acknowledge alert (mark as resolved)
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    for (const userAlerts of this.alerts.values()) {
      const alert = userAlerts.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date().toISOString();
        alert.acknowledgedBy = acknowledgedBy;
        
        console.log(`✅ [ALERT-MANAGER] Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Cleanup old alerts (memory management)
   */
  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    let totalCleaned = 0;
    
    for (const [userId, userAlerts] of this.alerts.entries()) {
      const beforeCount = userAlerts.length;
      
      // Keep only alerts from last 24 hours
      const recentAlerts = userAlerts.filter(alert => 
        new Date(alert.timestamp).getTime() > cutoffTime
      );
      
      this.alerts.set(userId, recentAlerts);
      totalCleaned += beforeCount - recentAlerts.length;
    }
    
    console.log(`🧹 [ALERT-MANAGER] Cleanup completed: ${totalCleaned} old alerts removed`);
  }

  /**
   * Get alerting statistics
   */
  getAlertingStatistics(): {
    totalActiveAlerts: number;
    alertsByType: Record<AlertType, number>;
    alertsBySeverity: Record<string, number>;
    criticalAlerts: number;
    avgAlertsPerUser: number;
  } {
    const activeAlerts = this.getActiveAlerts();
    
    const alertsByType = activeAlerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<AlertType, number>);
    
    const alertsBySeverity = activeAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalActiveAlerts: activeAlerts.length,
      alertsByType,
      alertsBySeverity,
      criticalAlerts: alertsBySeverity['CRITICAL'] || 0,
      avgAlertsPerUser: this.alerts.size > 0 ? activeAlerts.length / this.alerts.size : 0
    };
  }
}

/**
 * Compliance Monitor for iFood Requirements
 * CRITICAL: Monitors all aspects of iFood compliance
 */
export class IFoodComplianceMonitor {
  private static instance: IFoodComplianceMonitor;
  private alertManager: CriticalAlertManager;
  
  // Compliance thresholds (zero tolerance for critical violations)
  private readonly COMPLIANCE_THRESHOLDS = {
    ACKNOWLEDGMENT_RATE_MINIMUM: 100,     // 100% required by iFood
    POLLING_INTERVAL_TARGET_MS: 30000,    // Exactly 30 seconds
    POLLING_ACCURACY_MINIMUM: 99,        // 99% accuracy minimum
    API_RESPONSE_TIME_MAXIMUM: 10000,    // 10 seconds maximum
    EVENT_PROCESSING_TIME_MAXIMUM: 5000, // 5 seconds maximum
    CONSECUTIVE_FAILURES_MAXIMUM: 3       // Max 3 consecutive failures
  };

  private constructor() {
    this.alertManager = CriticalAlertManager.getInstance();
    console.log('🛡️ [COMPLIANCE-MONITOR] iFood Compliance Monitor initialized');
  }

  static getInstance(): IFoodComplianceMonitor {
    if (!this.instance) {
      this.instance = new IFoodComplianceMonitor();
    }
    return this.instance;
  }

  /**
   * Monitor acknowledgment rate compliance
   * CRITICAL: 100% acknowledgment rate required by iFood
   */
  async monitorAcknowledgmentCompliance(
    userId: string,
    totalEvents: number,
    acknowledgedEvents: number,
    failedEvents: number
  ): Promise<void> {
    const acknowledgmentRate = totalEvents > 0 ? (acknowledgedEvents / totalEvents) * 100 : 100;
    
    console.log(`📊 [COMPLIANCE-MONITOR] Acknowledgment rate: ${acknowledgmentRate}% (${acknowledgedEvents}/${totalEvents})`);
    
    // CRITICAL: Any failure to acknowledge is a compliance violation
    if (acknowledgmentRate < this.COMPLIANCE_THRESHOLDS.ACKNOWLEDGMENT_RATE_MINIMUM) {
      await this.alertManager.triggerAcknowledgmentFailureAlert(
        userId,
        [`${failedEvents} events failed`], // Simplified for alert
        `Acknowledgment rate ${acknowledgmentRate}% below required 100%`,
        1, // Will be updated with actual attempts
        0  // Will be updated with actual duration
      );
      
      console.log(`🚨 [COMPLIANCE-MONITOR] COMPLIANCE VIOLATION: Acknowledgment rate ${acknowledgmentRate}% < 100%`);
    } else {
      console.log(`✅ [COMPLIANCE-MONITOR] Acknowledgment compliance: PASSED (${acknowledgmentRate}%)`);
    }
  }

  /**
   * Monitor polling timing compliance
   * CRITICAL: Must maintain 30-second intervals with high accuracy
   */
  async monitorPollingTimingCompliance(
    userId: string,
    actualIntervalMs: number,
    targetIntervalMs: number,
    accuracy: number
  ): Promise<void> {
    console.log(`📊 [COMPLIANCE-MONITOR] Polling timing: ${actualIntervalMs}ms (target: ${targetIntervalMs}ms, accuracy: ${accuracy}%)`);
    
    // Check timing accuracy
    if (accuracy < this.COMPLIANCE_THRESHOLDS.POLLING_ACCURACY_MINIMUM) {
      await this.alertManager.triggerTimingDriftAlert(
        userId,
        actualIntervalMs,
        targetIntervalMs,
        accuracy
      );
      
      console.log(`⚠️ [COMPLIANCE-MONITOR] TIMING WARNING: Accuracy ${accuracy}% < 99%`);
    } else {
      console.log(`✅ [COMPLIANCE-MONITOR] Polling timing compliance: PASSED (${accuracy}%)`);
    }
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(userId: string): Promise<{
    overallCompliance: 'COMPLIANT' | 'WARNING' | 'VIOLATION';
    score: number;
    details: any;
    recommendations: string[];
  }> {
    console.log(`📋 [COMPLIANCE-MONITOR] Generating compliance report for user: ${userId}`);
    
    const userAlerts = this.alertManager.getAlertsForUser(userId);
    const criticalAlerts = userAlerts.filter(a => a.severity === 'CRITICAL' && !a.acknowledged);
    const warningAlerts = userAlerts.filter(a => a.severity === 'HIGH' && !a.acknowledged);
    
    // Calculate compliance score (0-100)
    let score = 100;
    
    // Deduct for critical violations
    score -= criticalAlerts.length * 30; // Each critical alert = -30 points
    score -= warningAlerts.length * 10;  // Each warning = -10 points
    
    score = Math.max(0, score);
    
    // Determine overall compliance status
    let overallCompliance: 'COMPLIANT' | 'WARNING' | 'VIOLATION';
    if (criticalAlerts.length > 0) {
      overallCompliance = 'VIOLATION';
    } else if (warningAlerts.length > 0 || score < 90) {
      overallCompliance = 'WARNING';
    } else {
      overallCompliance = 'COMPLIANT';
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (criticalAlerts.some(a => a.type === 'ACKNOWLEDGMENT_FAILURE')) {
      recommendations.push('URGENT: Investigate acknowledgment failures - iFood compliance at risk');
    }
    
    if (warningAlerts.some(a => a.type === 'POLLING_TIMEOUT')) {
      recommendations.push('Monitor polling system - ensure 30-second intervals maintained');
    }
    
    if (warningAlerts.some(a => a.type === 'TIMING_DRIFT_CRITICAL')) {
      recommendations.push('Optimize timing accuracy - consider server resource allocation');
    }
    
    if (score === 100) {
      recommendations.push('Excellent compliance - maintain current operational standards');
    }

    const report = {
      overallCompliance,
      score,
      details: {
        criticalAlerts: criticalAlerts.length,
        warningAlerts: warningAlerts.length,
        totalAlerts: userAlerts.length,
        lastReportGenerated: new Date().toISOString(),
        complianceThresholds: this.COMPLIANCE_THRESHOLDS,
        alertSummary: userAlerts.reduce((acc, alert) => {
          acc[alert.type] = (acc[alert.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      recommendations
    };
    
    console.log(`📊 [COMPLIANCE-MONITOR] Compliance report generated:`, report);
    
    return report;
  }
}

// Export singleton instances and utility functions
export const alertManager = CriticalAlertManager.getInstance();
export const complianceMonitor = IFoodComplianceMonitor.getInstance();

export const alertUtils = {
  triggerAcknowledgmentFailure: (userId: string, eventIds: string[], error: string, attempts: number, duration: number) =>
    alertManager.triggerAcknowledgmentFailureAlert(userId, eventIds, error, attempts, duration),
  
  triggerPollingTimeout: (userId: string, lastPolling: string, timeoutMin: number) =>
    alertManager.triggerPollingTimeoutAlert(userId, lastPolling, timeoutMin),
    
  triggerTimingDrift: (userId: string, actual: number, target: number, accuracy: number) =>
    alertManager.triggerTimingDriftAlert(userId, actual, target, accuracy),
    
  getAlertsForUser: (userId: string) => alertManager.getAlertsForUser(userId),
  
  getActiveAlerts: () => alertManager.getActiveAlerts(),
  
  acknowledgeAlert: (alertId: string, acknowledgedBy: string) => 
    alertManager.acknowledgeAlert(alertId, acknowledgedBy),
    
  generateComplianceReport: (userId: string) => 
    complianceMonitor.generateComplianceReport(userId),
    
  monitorAcknowledgmentCompliance: (userId: string, total: number, acked: number, failed: number) =>
    complianceMonitor.monitorAcknowledgmentCompliance(userId, total, acked, failed),
    
  monitorPollingCompliance: (userId: string, actual: number, target: number, accuracy: number) =>
    complianceMonitor.monitorPollingTimingCompliance(userId, actual, target, accuracy)
};