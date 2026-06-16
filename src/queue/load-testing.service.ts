// src/queue/load-testing.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bull';

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  name: string;
  durationMs: number;
  messagesPerSecond: number;
  messageSizeBytes: number;
  rampUpTimeMs: number;
  rampDownTimeMs: number;
  concurrency: number;
}

/**
 * Load test result
 */
export interface LoadTestResult {
  testName: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  totalMessages: number;
  messagesPerSecond: number;
  successCount: number;
  failureCount: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  throughputPerSecond: number;
  errors: Array<{ error: string; count: number }>;
}

/**
 * Load test metrics (real-time)
 */
interface LoadTestMetrics {
  timestamp: Date;
  messagesSent: number;
  messagesCompleted: number;
  messagesFailed: number;
  currentLatencyMs: number;
  currentThroughput: number;
}

/**
 * Load Testing Service
 * Provides comprehensive load testing capabilities for queue system
 */
@Injectable()
export class LoadTestingService {
  private readonly logger = new Logger(LoadTestingService.name);
  private activeTests: Map<string, {
    config: LoadTestConfig;
    metrics: LoadTestMetrics[];
    startTime: Date;
    isRunning: boolean;
  }> = new Map();
  private testIdCounter = 0;

  constructor(private eventEmitter: EventEmitter2) {
    this.logger.log('Load Testing Service initialized');
  }

  /**
   * Start a load test
   */
  async startTest(
    queue: Queue,
    config: LoadTestConfig,
  ): Promise<string> {
    const testId = `test-${++this.testIdCounter}-${Date.now()}`;
    
    this.logger.log(`Starting load test: ${config.name} (${testId})`);
    
    this.activeTests.set(testId, {
      config,
      metrics: [],
      startTime: new Date(),
      isRunning: true,
    });

    // Run test asynchronously
    this.runLoadTest(testId, queue, config).catch((error) => {
      this.logger.error(`Load test ${testId} failed: ${error}`);
    });

    return testId;
  }

  /**
   * Run load test
   */
  private async runLoadTest(
    testId: string,
    queue: Queue,
    config: LoadTestConfig,
  ): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) {
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + config.durationMs;
    const messageInterval = 1000 / config.messagesPerSecond;
    
    let messagesSent = 0;
    let messagesCompleted = 0;
    let messagesFailed = 0;
    const latencies: number[] = [];
    const errors: Map<string, number> = new Map();

    // Ramp-up phase
    const rampUpSteps = 10;
    const rampUpInterval = config.rampUpTimeMs / rampUpSteps;
    
    for (let step = 0; step < rampUpSteps && test.isRunning; step++) {
      const currentRate = (config.messagesPerSecond * (step + 1)) / rampUpSteps;
      await this.sendMessagesAtRate(queue, config, currentRate, messageInterval, latencies, errors);
      await this.delay(rampUpInterval);
    }

    // Main test phase
    while (Date.now() < endTime && test.isRunning) {
      const batchStartTime = Date.now();
      
      // Send messages at configured rate
      await this.sendMessagesAtRate(queue, config, config.messagesPerSecond, messageInterval, latencies, errors);
      
      // Record metrics
      const metrics: LoadTestMetrics = {
        timestamp: new Date(),
        messagesSent: messagesSent,
        messagesCompleted: messagesCompleted,
        messagesFailed: messagesFailed,
        currentLatencyMs: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
        currentThroughput: messagesCompleted / ((Date.now() - startTime) / 1000),
      };
      
      test.metrics.push(metrics);
      
      // Wait for next interval
      const elapsed = Date.now() - batchStartTime;
      if (elapsed < 1000) {
        await this.delay(1000 - elapsed);
      }
    }

    // Ramp-down phase
    for (let step = rampUpSteps - 1; step >= 0 && test.isRunning; step--) {
      const currentRate = (config.messagesPerSecond * (step + 1)) / rampUpSteps;
      await this.sendMessagesAtRate(queue, config, currentRate, messageInterval, latencies, errors);
      await this.delay(config.rampDownTimeMs / rampUpSteps);
    }

    // Calculate results
    const result = this.calculateResults(testId, config, startTime, Date.now(), messagesSent, messagesCompleted, messagesFailed, latencies, errors);
    
    test.isRunning = false;
    
    this.logger.log(`Load test completed: ${config.name}`);
    this.logger.log(`  Total messages: ${result.totalMessages}`);
    this.logger.log(`  Success rate: ${((result.successCount / result.totalMessages) * 100).toFixed(2)}%`);
    this.logger.log(`  Average latency: ${result.averageLatencyMs.toFixed(2)}ms`);
    this.logger.log(`  Throughput: ${result.throughputPerSecond.toFixed(2)} msg/s`);
    
    this.eventEmitter.emit('load-test.completed', result);
  }

  /**
   * Send messages at a specific rate
   */
  private async sendMessagesAtRate(
    queue: Queue,
    config: LoadTestConfig,
    rate: number,
    interval: number,
    latencies: number[],
    errors: Map<string, number>,
  ): Promise<void> {
    const messagesToSend = Math.ceil(rate * (interval / 1000));
    
    for (let i = 0; i < messagesToSend; i++) {
      const startTime = Date.now();
      
      try {
        const messageData = this.generateMessage(config.messageSizeBytes);
        await queue.add(messageData, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
        
        const latency = Date.now() - startTime;
        latencies.push(latency);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.set(errorMessage, (errors.get(errorMessage) || 0) + 1);
      }
      
      if (i < messagesToSend - 1) {
        await this.delay(interval / messagesToSend);
      }
    }
  }

  /**
   * Generate test message
   */
  private generateMessage(sizeBytes: number): any {
    const payload = 'x'.repeat(Math.max(0, sizeBytes - 100));
    
    return {
      type: 'load-test',
      timestamp: Date.now(),
      payload,
      testId: `test-${Date.now()}`,
    };
  }

  /**
   * Calculate test results
   */
  private calculateResults(
    testId: string,
    config: LoadTestConfig,
    startTime: number,
    endTime: number,
    messagesSent: number,
    messagesCompleted: number,
    messagesFailed: number,
    latencies: number[],
    errors: Map<string, number>,
  ): LoadTestResult {
    const durationMs = endTime - startTime;
    const totalMessages = messagesSent;
    
    // Sort latencies for percentile calculations
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    
    const averageLatencyMs = sortedLatencies.length > 0
      ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length
      : 0;
    
    const p50LatencyMs = this.calculatePercentile(sortedLatencies, 50);
    const p95LatencyMs = this.calculatePercentile(sortedLatencies, 95);
    const p99LatencyMs = this.calculatePercentile(sortedLatencies, 99);
    const maxLatencyMs = sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : 0;
    const minLatencyMs = sortedLatencies.length > 0 ? sortedLatencies[0] : 0;
    
    const throughputPerSecond = totalMessages / (durationMs / 1000);
    
    const errorArray = Array.from(errors.entries()).map(([error, count]) => ({
      error,
      count,
    }));

    return {
      testName: config.name,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      durationMs,
      totalMessages,
      messagesPerSecond: config.messagesPerSecond,
      successCount: messagesCompleted,
      failureCount: messagesFailed,
      averageLatencyMs,
      p50LatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      maxLatencyMs,
      minLatencyMs,
      throughputPerSecond,
      errors: errorArray,
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) {
      return 0;
    }
    
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Stop a running test
   */
  stopTest(testId: string): boolean {
    const test = this.activeTests.get(testId);
    if (test) {
      test.isRunning = false;
      this.logger.log(`Load test stopped: ${testId}`);
      return true;
    }
    return false;
  }

  /**
   * Get test status
   */
  getTestStatus(testId: string): {
    isRunning: boolean;
    config: LoadTestConfig;
    metricsCount: number;
    startTime: Date;
  } | null {
    const test = this.activeTests.get(testId);
    if (!test) {
      return null;
    }

    return {
      isRunning: test.isRunning,
      config: test.config,
      metricsCount: test.metrics.length,
      startTime: test.startTime,
    };
  }

  /**
   * Get all active tests
   */
  getActiveTests(): Array<{
    testId: string;
    config: LoadTestConfig;
    isRunning: boolean;
  }> {
    const tests: Array<{
      testId: string;
      config: LoadTestConfig;
      isRunning: boolean;
    }> = [];

    for (const [testId, test] of this.activeTests.entries()) {
      tests.push({
        testId,
        config: test.config,
        isRunning: test.isRunning,
      });
    }

    return tests;
  }

  /**
   * Get test metrics
   */
  getTestMetrics(testId: string): LoadTestMetrics[] {
    const test = this.activeTests.get(testId);
    return test ? test.metrics : [];
  }

  /**
   * Clean up completed tests
   */
  cleanupCompletedTests(): number {
    let cleanedCount = 0;

    for (const [testId, test] of this.activeTests.entries()) {
      if (!test.isRunning) {
        this.activeTests.delete(testId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} completed tests`);
    }

    return cleanedCount;
  }

  /**
   * Create default test configuration
   */
  createDefaultConfig(overrides?: Partial<LoadTestConfig>): LoadTestConfig {
    const defaultConfig: LoadTestConfig = {
      name: 'Default Load Test',
      durationMs: 60000, // 1 minute
      messagesPerSecond: 100,
      messageSizeBytes: 1024, // 1KB
      rampUpTimeMs: 10000, // 10 seconds
      rampDownTimeMs: 10000, // 10 seconds
      concurrency: 10,
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
