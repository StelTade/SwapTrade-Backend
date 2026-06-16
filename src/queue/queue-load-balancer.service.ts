// src/queue/queue-load-balancer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LoadBalancingStrategy,
  WorkerNode,
  HorizontalScalingConfig,
  DEFAULT_HORIZONTAL_SCALING_CONFIG,
} from './horizontal-scaling.config';

/**
 * Queue Load Balancer Service
 * Distributes jobs across available workers using various strategies
 */
@Injectable()
export class QueueLoadBalancerService {
  private readonly logger = new Logger(QueueLoadBalancerService.name);
  private config: HorizontalScalingConfig;
  private roundRobinIndex = 0;
  private workerWeights: Map<string, number> = new Map();
  private workerConnections: Map<string, number> = new Map();

  constructor(private eventEmitter: EventEmitter2) {
    this.config = DEFAULT_HORIZONTAL_SCALING_CONFIG;
    this.logger.log('Queue Load Balancer initialized');
  }

  /**
   * Select a worker based on the configured strategy
   */
  selectWorker(workers: WorkerNode[]): WorkerNode | null {
    const availableWorkers = workers.filter(
      (w) => w.status === 'active' || w.status === 'idle',
    );

    if (availableWorkers.length === 0) {
      this.logger.warn('No available workers for load balancing');
      return null;
    }

    switch (this.config.loadBalancing.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.roundRobinSelect(availableWorkers);
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.leastConnectionsSelect(availableWorkers);
      case LoadBalancingStrategy.WEIGHTED:
        return this.weightedSelect(availableWorkers);
      case LoadBalancingStrategy.ADAPTIVE:
        return this.adaptiveSelect(availableWorkers);
      default:
        return this.roundRobinSelect(availableWorkers);
    }
  }

  /**
   * Round-robin selection
   */
  private roundRobinSelect(workers: WorkerNode[]): WorkerNode {
    const worker = workers[this.roundRobinIndex % workers.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % workers.length;
    return worker;
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelect(workers: WorkerNode[]): WorkerNode {
    return workers.reduce((min, worker) => {
      const minConnections = this.workerConnections.get(min.workerId) || 0;
      const workerConnections = this.workerConnections.get(worker.workerId) || 0;
      return workerConnections < minConnections ? worker : min;
    });
  }

  /**
   * Weighted selection based on worker capacity
   */
  private weightedSelect(workers: WorkerNode[]): WorkerNode {
    // Calculate weights based on available capacity
    const weightedWorkers = workers.map((worker) => {
      const availableCapacity = worker.capacity - worker.currentLoad;
      const weight = this.workerWeights.get(worker.workerId) || 1;
      return {
        worker,
        weight: availableCapacity * weight,
      };
    });

    // Select based on weight
    const totalWeight = weightedWorkers.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const { worker, weight } of weightedWorkers) {
      random -= weight;
      if (random <= 0) {
        return worker;
      }
    }

    return workers[0];
  }

  /**
   * Adaptive selection based on multiple factors
   */
  private adaptiveSelect(workers: WorkerNode[]): WorkerNode {
    // Score each worker based on multiple factors
    const scoredWorkers = workers.map((worker) => {
      let score = 0;

      // Factor 1: Available capacity (higher is better)
      const availableCapacity = worker.capacity - worker.currentLoad;
      score += (availableCapacity / worker.capacity) * 40;

      // Factor 2: Average processing time (lower is better)
      const avgProcessingTime = worker.metrics.averageProcessingTimeMs;
      if (avgProcessingTime > 0) {
        score += Math.max(0, 20 - (avgProcessingTime / 1000));
      }

      // Factor 3: Success rate (higher is better)
      const totalJobs = worker.metrics.jobsProcessed + worker.metrics.jobsFailed;
      if (totalJobs > 0) {
        const successRate = worker.metrics.jobsProcessed / totalJobs;
        score += successRate * 30;
      }

      // Factor 4: Resource usage (lower is better)
      const resourceUsage = (worker.metrics.cpuUsagePercent + worker.metrics.memoryUsagePercent) / 2;
      score += Math.max(0, 10 - (resourceUsage / 10));

      return { worker, score };
    });

    // Select worker with highest score
    scoredWorkers.sort((a, b) => b.score - a.score);
    return scoredWorkers[0].worker;
  }

  /**
   * Record a connection to a worker
   */
  recordConnection(workerId: string): void {
    const current = this.workerConnections.get(workerId) || 0;
    this.workerConnections.set(workerId, current + 1);
  }

  /**
   * Release a connection from a worker
   */
  releaseConnection(workerId: string): void {
    const current = this.workerConnections.get(workerId) || 0;
    this.workerConnections.set(workerId, Math.max(0, current - 1));
  }

  /**
   * Set weight for a worker
   */
  setWorkerWeight(workerId: string, weight: number): void {
    this.workerWeights.set(workerId, weight);
  }

  /**
   * Get worker weight
   */
  getWorkerWeight(workerId: string): number {
    return this.workerWeights.get(workerId) || 1;
  }

  /**
   * Get connection count for a worker
   */
  getConnectionCount(workerId: string): number {
    return this.workerConnections.get(workerId) || 0;
  }

  /**
   * Get all connection counts
   */
  getAllConnectionCounts(): Map<string, number> {
    return new Map(this.workerConnections);
  }

  /**
   * Reset connection counts
   */
  resetConnectionCounts(): void {
    this.workerConnections.clear();
  }

  /**
   * Update load balancing strategy
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    this.config.loadBalancing.strategy = strategy;
    this.logger.log(`Load balancing strategy changed to: ${strategy}`);
    this.eventEmitter.emit('load-balancer.strategy-changed', { strategy });
  }

  /**
   * Get current strategy
   */
  getStrategy(): LoadBalancingStrategy {
    return this.config.loadBalancing.strategy;
  }

  /**
   * Health check for workers
   */
  async healthCheck(workers: WorkerNode[]): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();

    for (const worker of workers) {
      // Check if worker is responsive (has recent heartbeat)
      const now = new Date();
      const timeSinceHeartbeat = now.getTime() - worker.lastHeartbeat.getTime();
      const isHealthy = timeSinceHeartbeat < this.config.loadBalancing.healthCheckIntervalMs * 2;

      healthStatus.set(worker.workerId, isHealthy);

      if (!isHealthy) {
        this.logger.warn(`Worker ${worker.workerId} failed health check`);
        this.eventEmitter.emit('load-balancer.worker-unhealthy', { worker });
      }
    }

    return healthStatus;
  }

  /**
   * Get load balancer statistics
   */
  getStats(): {
    strategy: LoadBalancingStrategy;
    totalConnections: number;
    workerConnections: Record<string, number>;
    workerWeights: Record<string, number>;
  } {
    const totalConnections = Array.from(this.workerConnections.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      strategy: this.config.loadBalancing.strategy,
      totalConnections,
      workerConnections: Object.fromEntries(this.workerConnections),
      workerWeights: Object.fromEntries(this.workerWeights),
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): HorizontalScalingConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HorizontalScalingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.logger.log('Load balancer configuration updated');
  }
}