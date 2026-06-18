// src/queue/dynamic-scaling.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import {
  HorizontalScalingConfig,
  DEFAULT_HORIZONTAL_SCALING_CONFIG,
  ScalingEvent,
} from './horizontal-scaling.config';
import { QueueWorkerManagerService } from './queue-worker-manager.service';

/**
 * Queue metrics for scaling decisions
 */
export interface QueueMetrics {
  queueName: string;
  waitingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTimeMs: number;
  failureRate: number;
  throughputPerMinute: number;
  timestamp: Date;
}

/**
 * Scaling decision
 */
export interface ScalingDecision {
  shouldScale: boolean;
  direction: 'up' | 'down' | null;
  reason: string;
  currentMetrics: QueueMetrics;
  targetWorkers: number;
  confidence: number; // 0-100
}

/**
 * Dynamic Scaling Service
 * Automatically scales queue workers based on real-time metrics
 */
@Injectable()
export class DynamicScalingService {
  private readonly logger = new Logger(DynamicScalingService.name);
  private config: HorizontalScalingConfig;
  private metricsHistory: Map<string, QueueMetrics[]> = new Map();
  private lastScalingDecision: Map<string, ScalingDecision> = new Map();
  private queues: Map<string, Queue> = new Map();

  constructor(
    private eventEmitter: EventEmitter2,
    private workerManager: QueueWorkerManagerService,
  ) {
    this.config = DEFAULT_HORIZONTAL_SCALING_CONFIG;
    this.logger.log('Dynamic Scaling Service initialized');
  }

  /**
   * Register a queue for dynamic scaling
   */
  registerQueue(queueName: string, queue: Queue): void {
    this.queues.set(queueName, queue);
    this.metricsHistory.set(queueName, []);
    this.logger.log(`Queue registered for dynamic scaling: ${queueName}`);
  }

  /**
   * Unregister a queue
   */
  unregisterQueue(queueName: string): void {
    this.queues.delete(queueName);
    this.metricsHistory.delete(queueName);
    this.lastScalingDecision.delete(queueName);
    this.logger.log(`Queue unregistered from dynamic scaling: ${queueName}`);
  }

  /**
   * Collect metrics for a queue
   */
  async collectMetrics(queueName: string): Promise<QueueMetrics | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    try {
      const counts = await queue.getJobCounts();
      const completedJobs = await queue.getCompleted(0, 100);

      // Calculate average processing time
      const processingTimes: number[] = [];
      for (const job of completedJobs.slice(0, 50)) {
        if (job.finishedOn && job.processedOn) {
          processingTimes.push(job.finishedOn - job.processedOn);
        }
      }

      const averageProcessingTimeMs =
        processingTimes.length > 0
          ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
          : 0;

      // Calculate failure rate
      const totalProcessed = (counts.completed || 0) + (counts.failed || 0);
      const failureRate =
        totalProcessed > 0 ? ((counts.failed || 0) / totalProcessed) * 100 : 0;

      // Calculate throughput (jobs per minute)
      const history = this.metricsHistory.get(queueName) || [];
      let throughputPerMinute = 0;

      if (history.length >= 2) {
        const oldest = history[0];
        const newest = history[history.length - 1];
        const timeDiffMinutes =
          (newest.timestamp.getTime() - oldest.timestamp.getTime()) / 60000;

        if (timeDiffMinutes > 0) {
          const completedDiff = newest.completedJobs - oldest.completedJobs;
          throughputPerMinute = completedDiff / timeDiffMinutes;
        }
      }

      const metrics: QueueMetrics = {
        queueName,
        waitingJobs: counts.waiting || 0,
        activeJobs: counts.active || 0,
        completedJobs: counts.completed || 0,
        failedJobs: counts.failed || 0,
        averageProcessingTimeMs,
        failureRate,
        throughputPerMinute,
        timestamp: new Date(),
      };

      // Store metrics in history
      const historyArray = this.metricsHistory.get(queueName) || [];
      historyArray.push(metrics);

      // Keep only recent history (based on config window)
      const cutoffTime =
        Date.now() - this.config.dynamicScaling.metricsWindowMs;
      const filteredHistory = historyArray.filter(
        (m) => m.timestamp.getTime() > cutoffTime,
      );
      this.metricsHistory.set(queueName, filteredHistory);

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to collect metrics for ${queueName}: ${error}`);
      return null;
    }
  }

  /**
   * Make scaling decision based on metrics
   */
  makeScalingDecision(metrics: QueueMetrics): ScalingDecision {
    const currentWorkers = this.workerManager.getActiveWorkersCount();
    const reasons: string[] = [];
    let shouldScale = false;
    let direction: 'up' | 'down' | null = null;
    let confidence = 0;

    // Check for scale-up conditions
    if (metrics.waitingJobs > this.config.dynamicScaling.queueDepthThreshold) {
      shouldScale = true;
      direction = 'up';
      reasons.push(
        `Queue depth ${metrics.waitingJobs} exceeds threshold ${this.config.dynamicScaling.queueDepthThreshold}`,
      );
      confidence += 30;
    }

    if (
      metrics.averageProcessingTimeMs >
      this.config.dynamicScaling.processingTimeThresholdMs
    ) {
      shouldScale = true;
      direction = 'up';
      reasons.push(
        `Processing time ${metrics.averageProcessingTimeMs}ms exceeds threshold ${this.config.dynamicScaling.processingTimeThresholdMs}ms`,
      );
      confidence += 25;
    }

    if (
      metrics.failureRate >
      this.config.monitoring.alertThresholds.failureRateWarning
    ) {
      shouldScale = true;
      direction = 'up';
      reasons.push(
        `Failure rate ${metrics.failureRate}% exceeds warning threshold`,
      );
      confidence += 20;
    }

    // Check for scale-down conditions
    if (
      metrics.waitingJobs < this.config.workerPool.scaleDownThreshold &&
      metrics.activeJobs < this.config.workerPool.scaleDownThreshold &&
      currentWorkers > this.config.workerPool.minWorkers
    ) {
      shouldScale = true;
      direction = 'down';
      reasons.push(
        `Queue depth ${metrics.waitingJobs} below scale-down threshold`,
      );
      confidence += 40;
    }

    // Calculate target workers
    let targetWorkers = currentWorkers;
    if (shouldScale && direction === 'up') {
      const scaleUpFactor = Math.ceil(
        metrics.waitingJobs / this.config.workerPool.scaleUpThreshold,
      );
      targetWorkers = Math.min(
        currentWorkers + scaleUpFactor * this.config.workerPool.scaleUpStep,
        this.config.workerPool.maxWorkers,
      );
    } else if (shouldScale && direction === 'down') {
      targetWorkers = Math.max(
        currentWorkers - this.config.workerPool.scaleDownStep,
        this.config.workerPool.minWorkers,
      );
    }

    const decision: ScalingDecision = {
      shouldScale,
      direction,
      reason: reasons.join('; ') || 'No scaling needed',
      currentMetrics: metrics,
      targetWorkers,
      confidence: Math.min(confidence, 100),
    };

    return decision;
  }

  /**
   * Execute scaling decision
   */
  async executeScalingDecision(
    queueName: string,
    decision: ScalingDecision,
  ): Promise<ScalingEvent | null> {
    if (!decision.shouldScale || !decision.direction) {
      return null;
    }

    // Check cooldown
    const lastDecision = this.lastScalingDecision.get(queueName);
    if (lastDecision && lastDecision.shouldScale) {
      const timeSinceLastDecision =
        Date.now() - lastDecision.currentMetrics.timestamp.getTime();
      const cooldownMs =
        decision.direction === 'up'
          ? this.config.dynamicScaling.scaleUpCooldownMs
          : this.config.dynamicScaling.scaleDownCooldownMs;

      if (timeSinceLastDecision < cooldownMs) {
        this.logger.debug(
          `Scaling cooldown active for ${queueName}, skipping ${decision.direction} scale`,
        );
        return null;
      }
    }

    // Execute scaling
    let event: ScalingEvent;
    if (decision.direction === 'up') {
      const count =
        decision.targetWorkers - this.workerManager.getActiveWorkersCount();
      event = await this.workerManager.scaleUp(queueName, count);
    } else {
      const count =
        this.workerManager.getActiveWorkersCount() - decision.targetWorkers;
      event = await this.workerManager.scaleDown(queueName, count);
    }

    // Update metrics in event
    event.metrics = {
      queueDepth: decision.currentMetrics.waitingJobs,
      processingTimeMs: decision.currentMetrics.averageProcessingTimeMs,
      failureRate: decision.currentMetrics.failureRate,
    };

    this.lastScalingDecision.set(queueName, decision);
    this.logger.log(
      `Executed ${decision.direction} scaling for ${queueName}: ${event.previousWorkers} → ${event.newWorkers} workers`,
    );

    return event;
  }

  /**
   * Auto-scale all registered queues
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async autoScaleAll(): Promise<void> {
    if (!this.config.dynamicScaling.enabled) {
      return;
    }

    for (const [queueName, queue] of this.queues.entries()) {
      try {
        const metrics = await this.collectMetrics(queueName);
        if (!metrics) {
          continue;
        }

        const decision = this.makeScalingDecision(metrics);

        if (decision.shouldScale) {
          this.logger.log(
            `Scaling decision for ${queueName}: ${decision.direction} (confidence: ${decision.confidence}%)`,
          );

          await this.executeScalingDecision(queueName, decision);
        }
      } catch (error) {
        this.logger.error(`Auto-scaling failed for ${queueName}: ${error}`);
      }
    }
  }

  /**
   * Get metrics history for a queue
   */
  getMetricsHistory(queueName: string, limit?: number): QueueMetrics[] {
    const history = this.metricsHistory.get(queueName) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * Get last scaling decision for a queue
   */
  getLastScalingDecision(queueName: string): ScalingDecision | undefined {
    return this.lastScalingDecision.get(queueName);
  }

  /**
   * Get all scaling decisions
   */
  getAllScalingDecisions(): Map<string, ScalingDecision> {
    return new Map(this.lastScalingDecision);
  }

  /**
   * Get scaling statistics
   */
  getScalingStats(): {
    totalQueues: number;
    queuesWithScaling: number;
    totalScaleUpEvents: number;
    totalScaleDownEvents: number;
    averageConfidence: number;
  } {
    const decisions = Array.from(this.lastScalingDecision.values());
    const scaleUpEvents = decisions.filter((d) => d.direction === 'up').length;
    const scaleDownEvents = decisions.filter(
      (d) => d.direction === 'down',
    ).length;
    const avgConfidence =
      decisions.length > 0
        ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length
        : 0;

    return {
      totalQueues: this.queues.size,
      queuesWithScaling: this.lastScalingDecision.size,
      totalScaleUpEvents: scaleUpEvents,
      totalScaleDownEvents: scaleDownEvents,
      averageConfidence: avgConfidence,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HorizontalScalingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.logger.log('Dynamic scaling configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): HorizontalScalingConfig {
    return { ...this.config };
  }
}
