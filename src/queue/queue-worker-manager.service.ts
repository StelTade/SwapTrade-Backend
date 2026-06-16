// src/queue/queue-worker-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import {
  HorizontalScalingConfig,
  DEFAULT_HORIZONTAL_SCALING_CONFIG,
  WorkerNode,
  WorkerMetrics,
  ScalingEvent,
} from './horizontal-scaling.config';
import { QueueName } from './queue.constants';

/**
 * Queue Worker Manager Service
 * Manages dynamic scaling of queue workers based on load and metrics
 */
@Injectable()
export class QueueWorkerManagerService {
  private readonly logger = new Logger(QueueWorkerManagerService.name);
  private config: HorizontalScalingConfig;
  private workers: Map<string, WorkerNode> = new Map();
  private scalingHistory: ScalingEvent[] = [];
  private lastScaleUpTime: Map<string, Date> = new Map();
  private lastScaleDownTime: Map<string, Date> = new Map();
  private workerIdCounter = 0;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.config = this.loadConfig();
    this.logger.log('Queue Worker Manager initialized');
  }

  /**
   * Load configuration from environment or use defaults
   */
  private loadConfig(): HorizontalScalingConfig {
    const configOverrides = this.configService.get('HORIZONTAL_SCALING_CONFIG');
    return {
      ...DEFAULT_HORIZONTAL_SCALING_CONFIG,
      ...configOverrides,
    };
  }

  /**
   * Register a new worker node
   */
  registerWorker(
    hostname: string,
    pid: number,
    capacity: number = 10,
  ): WorkerNode {
    const workerId = `worker-${hostname}-${pid}-${++this.workerIdCounter}`;
    
    const worker: WorkerNode = {
      workerId,
      hostname,
      pid,
      status: 'active',
      capacity,
      currentLoad: 0,
      lastHeartbeat: new Date(),
      metrics: {
        jobsProcessed: 0,
        jobsFailed: 0,
        averageProcessingTimeMs: 0,
        cpuUsagePercent: 0,
        memoryUsagePercent: 0,
        uptimeMs: 0,
      },
    };

    this.workers.set(workerId, worker);
    this.logger.log(`Worker registered: ${workerId} (capacity: ${capacity})`);
    
    this.eventEmitter.emit('worker.registered', worker);
    return worker;
  }

  /**
   * Unregister a worker node
   */
  unregisterWorker(workerId: string): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) {
      this.logger.warn(`Worker not found: ${workerId}`);
      return false;
    }

    worker.status = 'offline';
    this.workers.delete(workerId);
    this.logger.log(`Worker unregistered: ${workerId}`);
    
    this.eventEmitter.emit('worker.unregistered', worker);
    return true;
  }

  /**
   * Update worker heartbeat
   */
  updateWorkerHeartbeat(workerId: string, metrics?: Partial<WorkerMetrics>): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return false;
    }

    worker.lastHeartbeat = new Date();
    
    if (metrics) {
      worker.metrics = {
        ...worker.metrics,
        ...metrics,
      };
    }

    return true;
  }

  /**
   * Update worker load
   */
  updateWorkerLoad(workerId: string, currentLoad: number): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return false;
    }

    worker.currentLoad = currentLoad;
    
    // Update status based on load
    if (currentLoad >= worker.capacity) {
      worker.status = 'busy';
    } else if (currentLoad > 0) {
      worker.status = 'active';
    } else {
      worker.status = 'idle';
    }

    return true;
  }

  /**
   * Get available worker with least load
   */
  getAvailableWorker(): WorkerNode | null {
    const activeWorkers = Array.from(this.workers.values()).filter(
      (w) => w.status === 'active' || w.status === 'idle',
    );

    if (activeWorkers.length === 0) {
      return null;
    }

    // Sort by current load (ascending)
    activeWorkers.sort((a, b) => a.currentLoad - b.currentLoad);
    
    return activeWorkers[0];
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): WorkerNode | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all workers
   */
  getAllWorkers(): WorkerNode[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get active workers count
   */
  getActiveWorkersCount(): number {
    return Array.from(this.workers.values()).filter(
      (w) => w.status === 'active' || w.status === 'idle' || w.status === 'busy',
    ).length;
  }

  /**
   * Check if scaling is needed for a queue
   */
  async checkScalingNeeded(
    queue: Queue,
    queueName: string,
  ): Promise<{ needed: boolean; direction: 'up' | 'down' | null; reason: string }> {
    const counts = await queue.getJobCounts();
    const waitingJobs = counts.waiting || 0;
    const activeJobs = counts.active || 0;

    // Check cooldown periods
    const now = new Date();
    const lastScaleUp = this.lastScaleUpTime.get(queueName);
    const lastScaleDown = this.lastScaleDownTime.get(queueName);

    if (lastScaleUp && now.getTime() - lastScaleUp.getTime() < this.config.workerPool.cooldownPeriodMs) {
      return { needed: false, direction: null, reason: 'Scale-up cooldown active' };
    }

    if (lastScaleDown && now.getTime() - lastScaleDown.getTime() < this.config.workerPool.cooldownPeriodMs) {
      return { needed: false, direction: null, reason: 'Scale-down cooldown active' };
    }

    // Check if scale-up is needed
    if (waitingJobs > this.config.workerPool.scaleUpThreshold) {
      const currentWorkers = this.getActiveWorkersCount();
      if (currentWorkers < this.config.workerPool.maxWorkers) {
        return {
          needed: true,
          direction: 'up',
          reason: `Queue depth ${waitingJobs} exceeds threshold ${this.config.workerPool.scaleUpThreshold}`,
        };
      }
    }

    // Check if scale-down is needed
    if (waitingJobs < this.config.workerPool.scaleDownThreshold && activeJobs < this.config.workerPool.scaleDownThreshold) {
      const currentWorkers = this.getActiveWorkersCount();
      if (currentWorkers > this.config.workerPool.minWorkers) {
        return {
          needed: true,
          direction: 'down',
          reason: `Queue depth ${waitingJobs} below threshold ${this.config.workerPool.scaleDownThreshold}`,
        };
      }
    }

    return { needed: false, direction: null, reason: 'No scaling needed' };
  }

  /**
   * Scale up workers
   */
  async scaleUp(
    queueName: string,
    count: number = this.config.workerPool.scaleUpStep,
  ): Promise<ScalingEvent> {
    const currentWorkers = this.getActiveWorkersCount();
    const newWorkers = Math.min(currentWorkers + count, this.config.workerPool.maxWorkers);
    const actualAdded = newWorkers - currentWorkers;

    // Register new workers
    for (let i = 0; i < actualAdded; i++) {
      this.registerWorker(`auto-${queueName}`, process.pid, 10);
    }

    const event: ScalingEvent = {
      timestamp: new Date(),
      type: 'scale-up',
      queueName,
      previousWorkers: currentWorkers,
      newWorkers,
      reason: `Auto-scaled up by ${actualAdded} workers`,
      metrics: {
        queueDepth: 0, // Will be filled by caller
        processingTimeMs: 0,
        failureRate: 0,
      },
    };

    this.scalingHistory.push(event);
    this.lastScaleUpTime.set(queueName, new Date());
    
    this.logger.log(`Scaled up ${queueName}: ${currentWorkers} → ${newWorkers} workers`);
    this.eventEmitter.emit('queue.scaled-up', event);
    
    return event;
  }

  /**
   * Scale down workers
   */
  async scaleDown(
    queueName: string,
    count: number = this.config.workerPool.scaleDownStep,
  ): Promise<ScalingEvent> {
    const currentWorkers = this.getActiveWorkersCount();
    const newWorkers = Math.max(currentWorkers - count, this.config.workerPool.minWorkers);
    const actualRemoved = currentWorkers - newWorkers;

    // Find idle workers to remove
    const idleWorkers = Array.from(this.workers.values())
      .filter((w) => w.status === 'idle')
      .slice(0, actualRemoved);

    for (const worker of idleWorkers) {
      this.unregisterWorker(worker.workerId);
    }

    const event: ScalingEvent = {
      timestamp: new Date(),
      type: 'scale-down',
      queueName,
      previousWorkers: currentWorkers,
      newWorkers,
      reason: `Auto-scaled down by ${actualRemoved} workers`,
      metrics: {
        queueDepth: 0,
        processingTimeMs: 0,
        failureRate: 0,
      },
    };

    this.scalingHistory.push(event);
    this.lastScaleDownTime.set(queueName, new Date());
    
    this.logger.log(`Scaled down ${queueName}: ${currentWorkers} → ${newWorkers} workers`);
    this.eventEmitter.emit('queue.scaled-down', event);
    
    return event;
  }

  /**
   * Auto-scale based on queue metrics
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async autoScale(): Promise<void> {
    if (!this.config.dynamicScaling.enabled) {
      return;
    }

    // This would be called with actual queue instances
    // For now, we'll emit an event for manual scaling checks
    this.eventEmitter.emit('queue.auto-scale-check', {
      timestamp: new Date(),
      workers: this.getAllWorkers(),
    });
  }

  /**
   * Check worker health and mark unhealthy workers
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  checkWorkerHealth(): void {
    const now = new Date();
    const heartbeatTimeout = 30000; // 30 seconds

    for (const [workerId, worker] of this.workers.entries()) {
      const timeSinceHeartbeat = now.getTime() - worker.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > heartbeatTimeout && worker.status !== 'offline') {
        worker.status = 'unhealthy';
        this.logger.warn(`Worker ${workerId} marked unhealthy (no heartbeat for ${timeSinceHeartbeat}ms)`);
        this.eventEmitter.emit('worker.unhealthy', worker);
      }
    }
  }

  /**
   * Get scaling history
   */
  getScalingHistory(limit: number = 100): ScalingEvent[] {
    return this.scalingHistory.slice(-limit);
  }

  /**
   * Get worker statistics
   */
  getWorkerStats(): {
    total: number;
    active: number;
    idle: number;
    busy: number;
    unhealthy: number;
    offline: number;
    totalCapacity: number;
    totalLoad: number;
    averageLoadPercent: number;
  } {
    const workers = Array.from(this.workers.values());
    
    const stats = {
      total: workers.length,
      active: workers.filter((w) => w.status === 'active').length,
      idle: workers.filter((w) => w.status === 'idle').length,
      busy: workers.filter((w) => w.status === 'busy').length,
      unhealthy: workers.filter((w) => w.status === 'unhealthy').length,
      offline: workers.filter((w) => w.status === 'offline').length,
      totalCapacity: workers.reduce((sum, w) => sum + w.capacity, 0),
      totalLoad: workers.reduce((sum, w) => sum + w.currentLoad, 0),
      averageLoadPercent: 0,
    };

    if (stats.totalCapacity > 0) {
      stats.averageLoadPercent = (stats.totalLoad / stats.totalCapacity) * 100;
    }

    return stats;
  }

  /**
   * Rebalance workers across queues
   */
  async rebalanceWorkers(queues: Map<string, Queue>): Promise<void> {
    this.logger.log('Rebalancing workers across queues...');
    
    const queueMetrics = new Map<string, number>();
    let totalWaiting = 0;

    // Collect queue depths
    for (const [queueName, queue] of queues.entries()) {
      const counts = await queue.getJobCounts();
      const waiting = counts.waiting || 0;
      queueMetrics.set(queueName, waiting);
      totalWaiting += waiting;
    }

    if (totalWaiting === 0) {
      this.logger.log('No jobs waiting, skipping rebalance');
      return;
    }

    // Calculate optimal worker distribution
    const totalWorkers = this.getActiveWorkersCount();
    const distribution = new Map<string, number>();

    for (const [queueName, waiting] of queueMetrics.entries()) {
      const proportion = waiting / totalWaiting;
      const workersForQueue = Math.max(1, Math.round(totalWorkers * proportion));
      distribution.set(queueName, workersForQueue);
    }

    this.logger.log(`Worker distribution: ${JSON.stringify(Object.fromEntries(distribution))}`);
    this.eventEmitter.emit('queue.rebalanced', { distribution, totalWorkers });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HorizontalScalingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.logger.log('Horizontal scaling configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): HorizontalScalingConfig {
    return { ...this.config };
  }
}
