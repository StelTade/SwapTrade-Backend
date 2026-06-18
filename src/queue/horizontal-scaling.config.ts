// src/queue/horizontal-scaling.config.ts

/**
 * Load balancing strategies
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round-robin',
  LEAST_CONNECTIONS = 'least-connections',
  WEIGHTED = 'weighted',
  ADAPTIVE = 'adaptive',
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Failing, reject requests
  HALF_OPEN = 'half-open', // Testing if service recovered
}

/**
 * Horizontal Scaling Configuration for Queue Processing System
 * Supports millions of messages per second with automatic load balancing
 */

export interface HorizontalScalingConfig {
  // Worker Management
  workerPool: {
    minWorkers: number;
    maxWorkers: number;
    scaleUpThreshold: number; // Queue depth to trigger scale up
    scaleDownThreshold: number; // Queue depth to trigger scale down
    scaleUpStep: number; // Number of workers to add
    scaleDownStep: number; // Number of workers to remove
    cooldownPeriodMs: number; // Time between scaling operations
  };

  // Load Balancing
  loadBalancing: {
    strategy: LoadBalancingStrategy;
    healthCheckIntervalMs: number;
    unhealthyThreshold: number; // Consecutive failures before marking unhealthy
    healthyThreshold: number; // Consecutive successes before marking healthy
  };

  // Fault Tolerance
  faultTolerance: {
    enableFailover: boolean;
    maxFailoverAttempts: number;
    failoverDelayMs: number;
    enableCircuitBreaker: boolean;
    circuitBreakerThreshold: number; // Failure rate to open circuit
    circuitBreakerResetTimeoutMs: number;
  };

  // Message Deduplication
  deduplication: {
    enabled: boolean;
    windowMs: number; // Time window for deduplication
    maxDeduplicationEntries: number;
    cleanupIntervalMs: number;
  };

  // Message Ordering
  ordering: {
    enabled: boolean;
    partitionKey: string; // Field to use for ordering (e.g., 'userId', 'orderId')
    maxPartitions: number;
    partitionTimeoutMs: number;
  };

  // Dynamic Scaling
  dynamicScaling: {
    enabled: boolean;
    metricsWindowMs: number; // Time window for metrics collection
    scaleUpCooldownMs: number;
    scaleDownCooldownMs: number;
    cpuThresholdPercent: number;
    memoryThresholdPercent: number;
    queueDepthThreshold: number;
    processingTimeThresholdMs: number;
  };

  // Performance Monitoring
  monitoring: {
    metricsCollectionIntervalMs: number;
    alertingEnabled: boolean;
    alertThresholds: {
      queueDepthWarning: number;
      queueDepthCritical: number;
      failureRateWarning: number;
      failureRateCritical: number;
      processingTimeWarningMs: number;
      processingTimeCriticalMs: number;
    };
  };

  // Zero-Loss Guarantees
  zeroLoss: {
    enabled: boolean;
    persistenceLevel: 'memory' | 'disk' | 'replicated';
    replicationFactor: number; // For replicated persistence
    acknowledgmentTimeoutMs: number;
    maxRetryAttempts: number;
  };
}

/**
 * Default horizontal scaling configuration
 */
export const DEFAULT_HORIZONTAL_SCALING_CONFIG: HorizontalScalingConfig = {
  workerPool: {
    minWorkers: 2,
    maxWorkers: 100,
    scaleUpThreshold: 1000, // Scale up when > 1000 jobs waiting
    scaleDownThreshold: 100, // Scale down when < 100 jobs waiting
    scaleUpStep: 5, // Add 5 workers at a time
    scaleDownStep: 2, // Remove 2 workers at a time
    cooldownPeriodMs: 30000, // 30 seconds between scaling operations
  },

  loadBalancing: {
    strategy: LoadBalancingStrategy.ADAPTIVE,
    healthCheckIntervalMs: 5000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
  },

  faultTolerance: {
    enableFailover: true,
    maxFailoverAttempts: 3,
    failoverDelayMs: 1000,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 0.5, // 50% failure rate opens circuit
    circuitBreakerResetTimeoutMs: 60000, // 1 minute
  },

  deduplication: {
    enabled: true,
    windowMs: 300000, // 5 minutes
    maxDeduplicationEntries: 1000000,
    cleanupIntervalMs: 60000, // 1 minute
  },

  ordering: {
    enabled: true,
    partitionKey: 'entityId',
    maxPartitions: 1000,
    partitionTimeoutMs: 30000, // 30 seconds
  },

  dynamicScaling: {
    enabled: true,
    metricsWindowMs: 60000, // 1 minute
    scaleUpCooldownMs: 60000, // 1 minute
    scaleDownCooldownMs: 300000, // 5 minutes
    cpuThresholdPercent: 80,
    memoryThresholdPercent: 85,
    queueDepthThreshold: 5000,
    processingTimeThresholdMs: 5000,
  },

  monitoring: {
    metricsCollectionIntervalMs: 10000, // 10 seconds
    alertingEnabled: true,
    alertThresholds: {
      queueDepthWarning: 1000,
      queueDepthCritical: 5000,
      failureRateWarning: 5,
      failureRateCritical: 10,
      processingTimeWarningMs: 3000,
      processingTimeCriticalMs: 10000,
    },
  },

  zeroLoss: {
    enabled: true,
    persistenceLevel: 'replicated',
    replicationFactor: 3,
    acknowledgmentTimeoutMs: 5000,
    maxRetryAttempts: 5,
  },
};

/**
 * Queue partition configuration for horizontal scaling
 */
export interface QueuePartition {
  partitionId: string;
  queueName: string;
  partitionKey: string;
  workerId?: string;
  isActive: boolean;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * Worker node configuration
 */
export interface WorkerNode {
  workerId: string;
  hostname: string;
  pid: number;
  status: 'active' | 'idle' | 'busy' | 'unhealthy' | 'offline';
  capacity: number; // Max concurrent jobs
  currentLoad: number; // Current active jobs
  lastHeartbeat: Date;
  metrics: WorkerMetrics;
}

/**
 * Worker metrics
 */
export interface WorkerMetrics {
  jobsProcessed: number;
  jobsFailed: number;
  averageProcessingTimeMs: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  uptimeMs: number;
}

/**
 * Scaling event
 */
export interface ScalingEvent {
  timestamp: Date;
  type: 'scale-up' | 'scale-down' | 'failover' | 'rebalance';
  queueName: string;
  previousWorkers: number;
  newWorkers: number;
  reason: string;
  metrics: {
    queueDepth: number;
    processingTimeMs: number;
    failureRate: number;
  };
}

/**
 * Message deduplication entry
 */
export interface DeduplicationEntry {
  messageId: string;
  fingerprint: string;
  timestamp: Date;
  expiresAt: Date;
}

/**
 * Message ordering partition
 */
export interface MessageOrderingPartition {
  partitionKey: string;
  queueName: string;
  messages: Array<{
    messageId: string;
    data: any;
    timestamp: Date;
    sequenceNumber: number;
  }>;
  isProcessing: boolean;
  lastProcessedAt?: Date;
}
