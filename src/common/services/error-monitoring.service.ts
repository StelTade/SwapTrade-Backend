import { Injectable, Logger } from '@nestjs/common';
import { ErrorCategorizer, ErrorCategory, ErrorSeverity } from '../exceptions/error-categorizer';

/**
 * Error event for monitoring
 */
export interface ErrorEvent {
  timestamp: Date;
  errorCode: string;
  errorMessage: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  correlationId?: string;
  userId?: string;
  service?: string;
  endpoint?: string;
  statusCode?: number;
  stackTrace?: string;
}

/**
 * Error metrics for dashboard
 */
export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByCode: Record<string, number>;
  errorRatePerMinute: number;
  errorRatePerHour: number;
  averageErrorResolutionTimeMs: number;
  topErrors: Array<{
    code: string;
    count: number;
    lastOccurrence: Date;
  }>;
  recentErrors: ErrorEvent[];
}

/**
 * Service for monitoring and tracking errors
 * Provides metrics and dashboard data for error analysis
 */
@Injectable()
export class ErrorMonitoringService {
  private readonly logger = new Logger(ErrorMonitoringService.name);
  private readonly errorEvents: ErrorEvent[] = [];
  private readonly maxEventsInMemory = 10000;
  private readonly errorTimestamps = new Map<string, number[]>(); // For rate calculation

  /**
   * Record an error event
   */
  recordError(error: any, context?: Partial<ErrorEvent>): void {
    const errorInfo = ErrorCategorizer.categorize(error);

    const event: ErrorEvent = {
      timestamp: new Date(),
      errorCode: errorInfo.code,
      errorMessage: errorInfo.message,
      category: errorInfo.category,
      severity: errorInfo.severity,
      ...context,
    };

    // Add to events
    this.errorEvents.push(event);

    // Maintain max size
    if (this.errorEvents.length > this.maxEventsInMemory) {
      this.errorEvents.shift();
    }

    // Track for rate calculation
    this.trackErrorTimestamp(errorInfo.code);

    this.logger.warn(
      `Error recorded: ${errorInfo.code} - ${errorInfo.message} (${errorInfo.category})`,
    );
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const errorsByCode: Record<string, number> = {};

    for (const event of this.errorEvents) {
      errorsByCategory[event.category] = (errorsByCategory[event.category] || 0) + 1;
      errorsBySeverity[event.severity] = (errorsBySeverity[event.severity] || 0) + 1;
      errorsByCode[event.errorCode] = (errorsByCode[event.errorCode] || 0) + 1;
    }

    // Calculate top errors
    const topErrors = Object.entries(errorsByCode)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([code, count]) => {
        const lastEvent = this.errorEvents
          .filter((e) => e.errorCode === code)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        return {
          code,
          count,
          lastOccurrence: lastEvent?.timestamp || new Date(),
        };
      });

    // Calculate error rates
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const errorsLastMinute = this.errorEvents.filter(
      (e) => e.timestamp.getTime() > oneMinuteAgo,
    ).length;

    const errorsLastHour = this.errorEvents.filter(
      (e) => e.timestamp.getTime() > oneHourAgo,
    ).length;

    // Get recent errors (last 100)
    const recentErrors = this.errorEvents.slice(-100);

    return {
      totalErrors: this.errorEvents.length,
      errorsByCategory,
      errorsBySeverity,
      errorsByCode,
      errorRatePerMinute: errorsLastMinute / 1,
      errorRatePerHour: errorsLastHour / 60,
      averageErrorResolutionTimeMs: 0, // Placeholder - implement based on your requirements
      topErrors,
      recentErrors,
    };
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): ErrorEvent[] {
    return this.errorEvents.filter((e) => e.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorEvent[] {
    return this.errorEvents.filter((e) => e.severity === severity);
  }

  /**
   * Get errors by code
   */
  getErrorsByCode(code: string): ErrorEvent[] {
    return this.errorEvents.filter((e) => e.errorCode === code);
  }

  /**
   * Get errors by user
   */
  getErrorsByUser(userId: string): ErrorEvent[] {
    return this.errorEvents.filter((e) => e.userId === userId);
  }

  /**
   * Get errors by time range
   */
  getErrorsByTimeRange(startTime: Date, endTime: Date): ErrorEvent[] {
    const start = startTime.getTime();
    const end = endTime.getTime();

    return this.errorEvents.filter(
      (e) => e.timestamp.getTime() >= start && e.timestamp.getTime() <= end,
    );
  }

  /**
   * Get error trend
   */
  getErrorTrend(intervalMs: number = 60000): Record<string, number> {
    const trend: Record<string, number> = {};
    const now = Date.now();

    for (const event of this.errorEvents) {
      const intervalStart = Math.floor(
        (event.timestamp.getTime() - now) / intervalMs,
      ) * intervalMs + now;
      const key = new Date(intervalStart).toISOString();

      trend[key] = (trend[key] || 0) + 1;
    }

    return trend;
  }

  /**
   * Get critical errors
   */
  getCriticalErrors(): ErrorEvent[] {
    return this.errorEvents.filter(
      (e) => e.severity === ErrorSeverity.CRITICAL,
    );
  }

  /**
   * Get error distribution by endpoint
   */
  getErrorsByEndpoint(): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const event of this.errorEvents) {
      if (event.endpoint) {
        distribution[event.endpoint] = (distribution[event.endpoint] || 0) + 1;
      }
    }

    return distribution;
  }

  /**
   * Clear old error events
   */
  clearOldEvents(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const initialLength = this.errorEvents.length;

    const filtered = this.errorEvents.filter(
      (e) => now - e.timestamp.getTime() < olderThanMs,
    );

    // Replace array contents
    this.errorEvents.length = 0;
    this.errorEvents.push(...filtered);

    const removed = initialLength - this.errorEvents.length;
    this.logger.log(`Cleared ${removed} old error events`);

    return removed;
  }

  /**
   * Clear all error events
   */
  clearAll(): number {
    const count = this.errorEvents.length;
    this.errorEvents.length = 0;
    this.errorTimestamps.clear();
    this.logger.log(`Cleared all ${count} error events`);
    return count;
  }

  /**
   * Get error event count
   */
  getEventCount(): number {
    return this.errorEvents.length;
  }

  /**
   * Track error timestamp for rate calculation
   */
  private trackErrorTimestamp(code: string): void {
    const now = Date.now();
    const timestamps = this.errorTimestamps.get(code) || [];

    // Remove timestamps older than 1 hour
    const oneHourAgo = now - 60 * 60 * 1000;
    const filtered = timestamps.filter((t) => t > oneHourAgo);

    filtered.push(now);
    this.errorTimestamps.set(code, filtered);
  }
}
