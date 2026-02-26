// src/queue/queue-analytics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import { QueueName } from './queue.constants';
import {
  DEFAULT_HEALTH_THRESHOLDS,
  QueueHealthThresholds,
} from './queue.config';

export interface QueueMetricsSnapshot {
  timestamp: Date;
  queueName: string;
  activeJobs: number;
  waitingJobs: number;
  completedJobs: number;
  failedJobs: number;
  delayedJobs: number;
  stalledJobs: number;
  isPaused: boolean;
  averageProcessingTime: number;
  averageWaitTime: number;
  successRate: number;
  failureRate: number;
  completionRate: number; // completed per minute
}

export interface QueueHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  thresholds: QueueHealthThresholds;
}

export interface AnalyticsReport {
  period: {
    startTime: Date;
    endTime: Date;
    duration: number; // milliseconds
  };
  queues: Record<string, QueueMetricsSnapshot>;
  aggregated: {
    totalJobs: number;
    totalActive: number;
    totalWaiting: number;
    totalFailed: number;
    overallSuccessRate: number;
  };
  alerts: Array<{
    queue: string;
    level: 'warning' | 'critical';
    message: string;
    timestamp: Date;
  }>;
}

/**
 * Queue Analytics Service
 * Provides detailed metrics, analytics, and performance monitoring
 */
@Injectable()
export class QueueAnalyticsService {
  private readonly logger = new Logger(QueueAnalyticsService.name);
  private metricsHistory: Map<string, QueueMetricsSnapshot[]> = new Map();
  private healthThresholds: QueueHealthThresholds = DEFAULT_HEALTH_THRESHOLDS;
  private readonly MAX_HISTORY_SIZE = 1440; // 24 hours of minute-level metrics
  private alerts: Array<{ queue: string; level: string; message: string; timestamp: Date }> =
    [];

  constructor() {
    this.initializeMetricsStorage();
  }

  /**
   * Initialize metrics storage for all queues
   */
  private initializeMetricsStorage(): void {
    for (const queue of Object.values(QueueName)) {
      this.metricsHistory.set(queue, []);
    }
  }

  /**
   * Record a metrics snapshot for a queue
   */
  recordMetrics(metrics: QueueMetricsSnapshot): void {
    const history = this.metricsHistory.get(metrics.queueName) || [];

    history.push(metrics);

    // Keep only recent history
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }

    this.metricsHistory.set(metrics.queueName, history);

    // Check health and generate alerts
    this.checkQueueHealth(metrics);
  }

  /**
   * Get current metrics for a queue
   */
  async getCurrentMetrics(queue: Queue): Promise<QueueMetricsSnapshot> {
    const counts = await queue.getJobCounts();

    // Calculate average processing time
    const completedJobs = await queue.getCompleted();
    const processingTimes: number[] = [];

    for (const job of completedJobs.slice(0, 100)) {
      if (job.finishedOn && job.processedOn) {
        processingTimes.push(job.finishedOn - job.processedOn);
      }
    }

    const averageProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b) / processingTimes.length
        : 0;

    // Calculate average wait time
    const waitingJobs = await queue.getWaiting();
    const waitTimes: number[] = [];

    for (const job of waitingJobs.slice(0, 100)) {
      if (job.timestamp) {
        waitTimes.push(Date.now() - job.timestamp);
      }
    }

    const averageWaitTime =
      waitTimes.length > 0
        ? waitTimes.reduce((a, b) => a + b) / waitTimes.length
        : 0;

    // Calculate rates
    const total = (counts.waiting || 0) + (counts.active || 0) + (counts.completed || 0) + (counts.failed || 0);
    const successRate =
      total > 0
        ? ((counts.completed / ((counts.completed || 0) + (counts.failed || 0))) * 100).toFixed(
            2,
          )
        : 0;

    const failureRate =
      total > 0
        ? ((counts.failed / ((counts.completed || 0) + (counts.failed || 0))) * 100).toFixed(
            2,
          )
        : 0;

    return {
      timestamp: new Date(),
      queueName: queue.name,
      activeJobs: counts.active || 0,
      waitingJobs: counts.waiting || 0,
      completedJobs: counts.completed || 0,
      failedJobs: counts.failed || 0,
      delayedJobs: counts.delayed || 0,
      stalledJobs: 0,  // Not available in current Bull API
      isPaused: await queue.isPaused(),
      averageProcessingTime,
      averageWaitTime,
      successRate: parseFloat(successRate as string),
      failureRate: parseFloat(failureRate as string),
      completionRate: (counts.completed || 0) / 60, // Assuming per minute
    };
  }

  /**
   * Get metrics history for a queue
   */
  getMetricsHistory(queueName: string, limit?: number): QueueMetricsSnapshot[] {
    let history = this.metricsHistory.get(queueName) || [];

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * Get health status for a queue
   */
  getQueueHealth(queueName: string): QueueHealthStatus {
    const history = this.metricsHistory.get(queueName) || [];

    if (history.length === 0) {
      return {
        status: 'healthy',
        issues: ['No metrics available yet'],
        thresholds: this.healthThresholds,
      };
    }

    const latest = history[history.length - 1];
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check waiting jobs
    if (latest.waitingJobs > this.healthThresholds.criticalWaitingCount) {
      issues.push(
        `Critical: ${latest.waitingJobs} waiting jobs exceeds threshold of ${this.healthThresholds.criticalWaitingCount}`,
      );
      status = 'critical';
    } else if (latest.waitingJobs > this.healthThresholds.warningWaitingCount) {
      issues.push(
        `Warning: ${latest.waitingJobs} waiting jobs exceeds threshold of ${this.healthThresholds.warningWaitingCount}`,
      );
      if (status === 'healthy') status = 'warning';
    }

    // Check failure rate
    if (latest.failureRate > this.healthThresholds.criticalFailureRate) {
      issues.push(
        `Critical: Failure rate ${latest.failureRate}% exceeds threshold of ${this.healthThresholds.criticalFailureRate}%`,
      );
      status = 'critical';
    } else if (latest.failureRate > this.healthThresholds.warningFailureRate) {
      issues.push(
        `Warning: Failure rate ${latest.failureRate}% exceeds threshold of ${this.healthThresholds.warningFailureRate}%`,
      );
      if (status === 'healthy') status = 'warning';
    }

    // Check processing time
    if (
      latest.averageProcessingTime >
      this.healthThresholds.maxProcessingTimeMs
    ) {
      issues.push(
        `Warning: Average processing time ${latest.averageProcessingTime}ms exceeds threshold of ${this.healthThresholds.maxProcessingTimeMs}ms`,
      );
      if (status === 'healthy') status = 'warning';
    }

    return {
      status,
      issues: issues.length > 0 ? issues : ['No issues detected'],
      thresholds: this.healthThresholds,
    };
  }

  /**
   * Generate analytics report
   */
  generateAnalyticsReport(
    startTime: Date,
    endTime: Date,
  ): AnalyticsReport {
    const report: AnalyticsReport = {
      period: {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      },
      queues: {},
      aggregated: {
        totalJobs: 0,
        totalActive: 0,
        totalWaiting: 0,
        totalFailed: 0,
        overallSuccessRate: 0,
      },
      alerts: [],
    };

    let totalCompleted = 0;
    let totalFailed = 0;

    // Collect metrics within time range
    for (const [queueName, history] of this.metricsHistory) {
      const filtered = history.filter(
        (m) => m.timestamp >= startTime && m.timestamp <= endTime,
      );

      if (filtered.length > 0) {
        const latest = filtered[filtered.length - 1];
        report.queues[queueName] = latest;

        report.aggregated.totalJobs +=
          latest.waitingJobs +
          latest.activeJobs +
          latest.completedJobs +
          latest.failedJobs;
        report.aggregated.totalActive += latest.activeJobs;
        report.aggregated.totalWaiting += latest.waitingJobs;
        report.aggregated.totalFailed += latest.failedJobs;

        totalCompleted += latest.completedJobs;
        totalFailed += latest.failedJobs;
      }
    }

    // Calculate overall success rate
    if (totalCompleted + totalFailed > 0) {
      report.aggregated.overallSuccessRate =
        (totalCompleted / (totalCompleted + totalFailed)) * 100;
    }

    // Include alerts
    report.alerts = this.alerts
      .filter((a) => a.timestamp >= startTime && a.timestamp <= endTime)
      .map(
        (a) =>
          ({
            queue: a.queue,
            level: a.level as 'warning' | 'critical',
            message: a.message,
            timestamp: a.timestamp,
          } as const),
      );

    return report;
  }

  /**
   * Update health thresholds
   */
  setHealthThresholds(thresholds: Partial<QueueHealthThresholds>): void {
    this.healthThresholds = { ...this.healthThresholds, ...thresholds };
    this.logger.log('Health thresholds updated');
  }

  /**
   * Get current health thresholds
   */
  getHealthThresholds(): QueueHealthThresholds {
    return this.healthThresholds;
  }

  // ==================== Private Methods ====================

  private checkQueueHealth(metrics: QueueMetricsSnapshot): void {
    const health = this.getQueueHealth(metrics.queueName);

    if (health.status !== 'healthy') {
      for (const issue of health.issues) {
        const level: 'warning' | 'critical' = health.status as 'warning' | 'critical';
        this.alerts.push({
          queue: metrics.queueName,
          level,
          message: issue,
          timestamp: new Date(),
        });
      }

      // Keep only recent alerts
      if (this.alerts.length > 1000) {
        this.alerts = this.alerts.slice(-1000);
      }

      this.logger.warn(
        `[${health.status.toUpperCase()}] ${metrics.queueName}: ${health.issues.join(', ')}`,
      );
    }
  }
}
