import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DatabaseShardingService } from './database-sharding.service';
import { PerformanceMonitoringService } from './performance-monitoring.service';

export interface LoadBalancerConfig {
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'response-time';
  healthCheckInterval: number;
  maxRetries: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export interface DatabaseNode {
  id: string;
  dataSource: DataSource;
  weight: number;
  activeConnections: number;
  totalRequests: number;
  averageResponseTime: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
  circuitBreakerOpen: boolean;
  circuitBreakerOpenedAt?: Date;
}

export interface LoadBalancingResult<T> {
  result: T;
  nodeId: string;
  executionTime: number;
  retryCount: number;
  fromCache: boolean;
}

@Injectable()
export class DatabaseLoadBalancerService {
  private readonly logger = new Logger(DatabaseLoadBalancerService.name);
  private nodes: Map<string, DatabaseNode> = new Map();
  private roundRobinIndex = 0;
  private config: LoadBalancerConfig;

  constructor(
    private readonly shardingService: DatabaseShardingService,
    private readonly monitoringService: PerformanceMonitoringService,
  ) {
    this.config = {
      strategy: 'least-connections',
      healthCheckInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 100, // 100ms
      circuitBreakerThreshold: 5, // 5 failures
      circuitBreakerTimeout: 60000, // 1 minute
    };

    this.startHealthCheckLoop();
  }

  /**
   * Initialize load balancer with database nodes
   */
  async initializeNodes(
    nodeConfigs: Array<{ id: string; dataSource: DataSource; weight?: number }>,
  ): Promise<void> {
    this.logger.log(
      `Initializing load balancer with ${nodeConfigs.length} nodes`,
    );

    for (const config of nodeConfigs) {
      const node: DatabaseNode = {
        id: config.id,
        dataSource: config.dataSource,
        weight: config.weight || 1,
        activeConnections: 0,
        totalRequests: 0,
        averageResponseTime: 0,
        isHealthy: true,
        lastHealthCheck: new Date(),
        circuitBreakerOpen: false,
      };

      this.nodes.set(config.id, node);
      this.logger.log(
        `Node ${config.id} initialized with weight ${node.weight}`,
      );
    }

    this.logger.log('Load balancer initialization completed');
  }

  /**
   * Execute a read operation with load balancing
   */
  async executeRead<T>(
    operation: (repository: Repository<any>) => Promise<T>,
    entityClass?: any,
    options?: {
      preferShard?: string;
      forceNode?: string;
    },
  ): Promise<LoadBalancingResult<T>> {
    return this.executeWithLoadBalancing(
      operation,
      'read',
      entityClass,
      options,
    );
  }

  /**
   * Execute a write operation with load balancing
   */
  async executeWrite<T>(
    operation: (repository: Repository<any>) => Promise<T>,
    entityClass?: any,
    options?: {
      preferShard?: string;
      forceNode?: string;
    },
  ): Promise<LoadBalancingResult<T>> {
    return this.executeWithLoadBalancing(
      operation,
      'write',
      entityClass,
      options,
    );
  }

  /**
   * Execute query with load balancing and retry logic
   */
  private async executeWithLoadBalancing<T>(
    operation: (repository: Repository<any>) => Promise<T>,
    operationType: 'read' | 'write',
    entityClass?: any,
    options?: {
      preferShard?: string;
      forceNode?: string;
    },
  ): Promise<LoadBalancingResult<T>> {
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.config.maxRetries) {
      try {
        const nodeId =
          options?.forceNode ||
          options?.preferShard ||
          this.selectNode(operationType);

        const node = this.nodes.get(nodeId);
        if (!node) {
          throw new Error(`Node ${nodeId} not found`);
        }

        // Check circuit breaker
        if (node.circuitBreakerOpen) {
          if (this.shouldResetCircuitBreaker(node)) {
            node.circuitBreakerOpen = false;
            node.circuitBreakerOpenedAt = undefined;
            this.logger.log(`Circuit breaker reset for node ${nodeId}`);
          } else {
            throw new Error(`Circuit breaker open for node ${nodeId}`);
          }
        }

        // Execute operation
        const startTime = Date.now();
        node.activeConnections++;
        node.totalRequests++;

        try {
          const repository = entityClass
            ? node.dataSource.getRepository(entityClass)
            : null;

          const result = repository
            ? await operation(repository)
            : await this.executeDirectOperation(node.dataSource, operation);

          const executionTime = Date.now() - startTime;

          // Update node metrics
          this.updateNodeMetrics(node, executionTime, true);

          return {
            result,
            nodeId,
            executionTime,
            retryCount,
            fromCache: false,
          };
        } finally {
          node.activeConnections--;
        }
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        // Update failed node metrics
        if (options?.forceNode) {
          const node = this.nodes.get(options.forceNode);
          if (node) {
            this.updateNodeMetrics(node, 0, false);
          }
        }

        this.logger.warn(
          `Operation failed (attempt ${retryCount}/${this.config.maxRetries + 1}):`,
          error.message,
        );

        // Wait before retry
        if (retryCount <= this.config.maxRetries) {
          await this.delay(this.config.retryDelay * retryCount);
        }
      }
    }

    throw lastError || new Error('Operation failed after all retries');
  }

  /**
   * Select optimal node based on strategy
   */
  private selectNode(operationType: 'read' | 'write'): string {
    const healthyNodes = Array.from(this.nodes.values()).filter(
      (node) => node.isHealthy && !node.circuitBreakerOpen,
    );

    if (healthyNodes.length === 0) {
      throw new Error('No healthy nodes available');
    }

    switch (this.config.strategy) {
      case 'round-robin':
        return this.selectRoundRobin(healthyNodes);

      case 'least-connections':
        return this.selectLeastConnections(healthyNodes);

      case 'weighted':
        return this.selectWeighted(healthyNodes);

      case 'response-time':
        return this.selectByResponseTime(healthyNodes);

      default:
        return this.selectLeastConnections(healthyNodes);
    }
  }

  /**
   * Round-robin node selection
   */
  private selectRoundRobin(nodes: DatabaseNode[]): string {
    const node = nodes[this.roundRobinIndex % nodes.length];
    this.roundRobinIndex++;
    return node.id;
  }

  /**
   * Least connections node selection
   */
  private selectLeastConnections(nodes: DatabaseNode[]): string {
    return nodes.reduce((min, current) =>
      current.activeConnections < min.activeConnections ? current : min,
    ).id;
  }

  /**
   * Weighted node selection
   */
  private selectWeighted(nodes: DatabaseNode[]): string {
    const totalWeight = nodes.reduce((sum, node) => sum + node.weight, 0);
    let random = Math.random() * totalWeight;

    for (const node of nodes) {
      random -= node.weight;
      if (random <= 0) {
        return node.id;
      }
    }

    return nodes[0].id;
  }

  /**
   * Response time based node selection
   */
  private selectByResponseTime(nodes: DatabaseNode[]): string {
    return nodes.reduce((best, current) =>
      current.averageResponseTime < best.averageResponseTime ? current : best,
    ).id;
  }

  /**
   * Update node metrics after operation
   */
  private updateNodeMetrics(
    node: DatabaseNode,
    executionTime: number,
    success: boolean,
  ): void {
    // Update response time (exponential moving average)
    const alpha = 0.1; // Smoothing factor
    node.averageResponseTime =
      node.averageResponseTime * (1 - alpha) + executionTime * alpha;

    // Handle circuit breaker
    if (!success) {
      const recentFailures = this.getRecentFailures(node);
      if (recentFailures >= this.config.circuitBreakerThreshold) {
        node.circuitBreakerOpen = true;
        node.circuitBreakerOpenedAt = new Date();
        this.logger.warn(`Circuit breaker opened for node ${node.id}`);
      }
    }
  }

  /**
   * Get recent failure count for a node
   */
  private getRecentFailures(node: DatabaseNode): number {
    // Simplified - in production, track actual failures
    return node.circuitBreakerOpen ? this.config.circuitBreakerThreshold : 0;
  }

  /**
   * Check if circuit breaker should be reset
   */
  private shouldResetCircuitBreaker(node: DatabaseNode): boolean {
    if (!node.circuitBreakerOpenedAt) return false;

    const timeSinceOpen = Date.now() - node.circuitBreakerOpenedAt.getTime();
    return timeSinceOpen >= this.config.circuitBreakerTimeout;
  }

  /**
   * Health check loop
   */
  private startHealthCheckLoop(): void {
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    this.logger.log('Health check loop started');
  }

  /**
   * Perform health checks on all nodes
   */
  private async performHealthChecks(): Promise<void> {
    for (const [nodeId, node] of this.nodes) {
      try {
        const startTime = Date.now();
        await node.dataSource.query('SELECT 1');
        const responseTime = Date.now() - startTime;

        node.isHealthy = true;
        node.lastHealthCheck = new Date();

        // Update response time metric
        const alpha = 0.1;
        node.averageResponseTime =
          node.averageResponseTime * (1 - alpha) + responseTime * alpha;

        this.logger.debug(
          `Health check passed for node ${nodeId} in ${responseTime}ms`,
        );
      } catch (error) {
        node.isHealthy = false;
        node.lastHealthCheck = new Date();
        this.logger.warn(
          `Health check failed for node ${nodeId}:`,
          error.message,
        );
      }
    }
  }

  /**
   * Get load balancer statistics
   */
  getStatistics(): any {
    const nodes = Array.from(this.nodes.values());

    return {
      totalNodes: nodes.length,
      healthyNodes: nodes.filter((n) => n.isHealthy).length,
      totalRequests: nodes.reduce((sum, n) => sum + n.totalRequests, 0),
      totalActiveConnections: nodes.reduce(
        (sum, n) => sum + n.activeConnections,
        0,
      ),
      averageResponseTime:
        nodes.reduce((sum, n) => sum + n.averageResponseTime, 0) / nodes.length,
      circuitBreakersOpen: nodes.filter((n) => n.circuitBreakerOpen).length,
      strategy: this.config.strategy,
      nodes: nodes.map((node) => ({
        id: node.id,
        isHealthy: node.isHealthy,
        activeConnections: node.activeConnections,
        totalRequests: node.totalRequests,
        averageResponseTime: node.averageResponseTime,
        weight: node.weight,
        circuitBreakerOpen: node.circuitBreakerOpen,
      })),
    };
  }

  /**
   * Update load balancer configuration
   */
  updateConfig(newConfig: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Load balancer configuration updated');
  }

  /**
   * Add a new node
   */
  addNode(id: string, dataSource: DataSource, weight: number = 1): void {
    const node: DatabaseNode = {
      id,
      dataSource,
      weight,
      activeConnections: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      isHealthy: true,
      lastHealthCheck: new Date(),
      circuitBreakerOpen: false,
    };

    this.nodes.set(id, node);
    this.logger.log(`Node ${id} added with weight ${weight}`);
  }

  /**
   * Remove a node
   */
  removeNode(id: string): void {
    if (this.nodes.delete(id)) {
      this.logger.log(`Node ${id} removed`);
    }
  }

  /**
   * Execute direct operation (when repository is not available)
   */
  private async executeDirectOperation<T>(
    dataSource: DataSource,
    operation: (repository: Repository<any>) => Promise<T>,
  ): Promise<T> {
    // This is a placeholder - in practice, you might need to handle
    // different types of operations that don't require a repository
    throw new Error('Direct operation execution not implemented');
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.log('Shutting down load balancer...');

    // Wait for all active connections to complete
    let activeConnections = Array.from(this.nodes.values()).reduce(
      (sum, node) => sum + node.activeConnections,
      0,
    );

    while (activeConnections > 0) {
      this.logger.log(`Waiting for ${activeConnections} active connections...`);
      await this.delay(1000);
      activeConnections = Array.from(this.nodes.values()).reduce(
        (sum, node) => sum + node.activeConnections,
        0,
      );
    }

    this.logger.log('Load balancer shutdown completed');
  }
}
