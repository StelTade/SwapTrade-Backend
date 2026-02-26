/**
 * Integration Examples - Error Handling System
 * Real-world usage patterns and best practices
 */

import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { RetryService } from '../services/retry.service';
import { CorrelationIdService } from '../services/correlation-id.service';
import { DeadLetterQueueService } from '../services/dead-letter-queue.service';
import { ErrorMonitoringService } from '../services/error-monitoring.service';
import { BulkheadService } from '../services/bulkhead.service';
import { SagaService, type SagaStep } from '../services/saga.service';

/**
 * Example 1: External API Client with Circuit Breaker and Retry
 */
@Injectable()
export class ResilientExternalApiClient {
  private readonly logger = new Logger(ResilientExternalApiClient.name);

  constructor(
    private circuitBreakerService: CircuitBreakerService,
    private retryService: RetryService,
    private correlationIdService: CorrelationIdService,
  ) {
    this.setupCircuitBreaker();
  }

  private setupCircuitBreaker(): void {
    this.circuitBreakerService.register(
      this.callExternalAPI.bind(this),
      {
        name: 'external-dex-api',
        timeout: 5000,
        errorThresholdPercentage: 50,
        volumeThreshold: 10,
        fallback: () => this.getFallbackData(),
      },
    );
  }

  async getTokenPrice(tokenAddress: string): Promise<any> {
    const correlationId = this.correlationIdService.getCorrelationId();

    this.logger.log(
      `[${correlationId}] Fetching token price for ${tokenAddress}`,
    );

    const result = await this.retryService.executeWithRetry(
      async () => {
        return this.circuitBreakerService.execute(
          'external-dex-api',
          () => this.callExternalAPI(tokenAddress),
          tokenAddress,
        );
      },
      'moderate',
      'getTokenPrice',
    );

    if (!result.success) {
      this.logger.error(
        `[${correlationId}] Failed to fetch token price: ${result.error?.message}`,
      );
      throw result.error;
    }

    return result.result;
  }

  private async callExternalAPI(tokenAddress: string): Promise<any> {
    // Simulate external API call
    const response = await fetch(`https://api.dex.com/price/${tokenAddress}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  private getFallbackData(): Record<string, any> {
    return { price: 0, cached: true };
  }
}

/**
 * Example 2: Database Operations with Bulkhead and Connection Pooling
 */
@Injectable()
export class ResilientDatabaseService {
  private readonly logger = new Logger(ResilientDatabaseService.name);

  constructor(
    private bulkheadService: BulkheadService,
    private retryService: RetryService,
    private correlationIdService: CorrelationIdService,
  ) {
    this.setupBulkheads();
  }

  private setupBulkheads(): void {
    // Separate bulkheads for reads and writes
    this.bulkheadService.createBulkhead({
      name: 'db-read',
      maxConcurrent: 20,
      timeout: 10000,
    });

    this.bulkheadService.createBulkhead({
      name: 'db-write',
      maxConcurrent: 5,
      timeout: 15000,
    });
  }

  async queryUser(userId: string): Promise<any> {
    return this.bulkheadService.execute(
      'db-read',
      async () => {
        const result = await this.retryService.executeWithRetry(
          async () => this.fetchUser(userId),
          'moderate',
          'queryUser',
        );

        if (!result.success) {
          throw result.error;
        }

        return result.result;
      },
      'queryUser',
    );
  }

  async updateUserBalance(userId: string, newBalance: number): Promise<void> {
    return this.bulkheadService.execute(
      'db-write',
      async () => {
        const result = await this.retryService.executeWithRetry(
          async () => this.updateBalance(userId, newBalance),
          'conservative',
          'updateUserBalance',
        );

        if (!result.success) {
          throw result.error;
        }
      },
      'updateUserBalance',
    );
  }

  private async fetchUser(userId: string): Promise<any> {
    // Database fetch logic
    // Simulated delay
    await new Promise((r) => setTimeout(r, 100));
    return { id: userId, balance: 1000 };
  }

  private async updateBalance(userId: string, balance: number): Promise<void> {
    // Database update logic
    // Simulated delay
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * Example 3: Async Job Processing with DLQ and Monitoring
 */
@Injectable()
export class ResilientJobProcessor {
  private readonly logger = new Logger(ResilientJobProcessor.name);

  constructor(
    private deadLetterQueueService: DeadLetterQueueService,
    private retryService: RetryService,
    private errorMonitoringService: ErrorMonitoringService,
    private correlationIdService: CorrelationIdService,
  ) {
    this.setupDLQ();
    this.setupDLQMonitoring();
  }

  private setupDLQ(): void {
    this.deadLetterQueueService.registerDLQ('notifications', {
      maxRetries: 3,
      retentionDays: 7,
      notifyOnThreshold: 50,
    });

    this.deadLetterQueueService.registerDLQ('transactions', {
      maxRetries: 5,
      retentionDays: 30,
      notifyOnThreshold: 100,
    });
  }

  private setupDLQMonitoring(): void {
    // Monitor DLQ messages
    this.deadLetterQueueService.onDLQMessage(
      'notifications',
      (message) => {
        this.logger.error(
          `Critical: Notification failed - ${message.functionName}`,
          message,
        );

        // Send alert to monitoring service
        this.errorMonitoringService.recordError(
          new Error(message.error.message),
          {
            correlationId: message.correlationId,
            endpoint: 'job-processor',
            severity: 'HIGH' as any,
          },
        );
      },
    );
  }

  async processNotification(jobData: any): Promise<void> {
    const correlationId = this.correlationIdService.getCorrelationId();

    try {
      const result = await this.retryService.executeWithRetry(
        async () => this.sendNotification(jobData),
        'moderate',
        'processNotification',
      );

      if (!result.success) {
        await this.deadLetterQueueService.sendToDLQ(
          'notifications',
          jobData.jobId,
          'processNotification',
          jobData,
          result.error!,
          result.attempts,
        );

        this.logger.error(
          `[${correlationId}] Notification job sent to DLQ: ${jobData.jobId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Unexpected error processing notification`,
        error,
      );

      await this.deadLetterQueueService.sendToDLQ(
        'notifications',
        jobData.jobId,
        'processNotification',
        jobData,
        error instanceof Error ? error : new Error(String(error)),
        3,
      );
    }
  }

  private async sendNotification(jobData: any): Promise<void> {
    // Notification sending logic
    // Simulated delay
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Example 4: Complex Distributed Swap Transaction with Saga
 */
@Injectable()
export class ResilientSwapService {
  private readonly logger = new Logger(ResilientSwapService.name);

  constructor(
    private sagaService: SagaService,
    private circuitBreakerService: CircuitBreakerService,
    private retryService: RetryService,
    private deadLetterQueueService: DeadLetterQueueService,
    private correlationIdService: CorrelationIdService,
  ) {
    this.setupExternalServices();
    this.setupDLQ();
  }

  private setupExternalServices(): void {
    this.circuitBreakerService.register(
      this.callDexAPI.bind(this),
      {
        name: 'dex-swap',
        timeout: 3000,
        errorThresholdPercentage: 50,
      },
    );
  }

  private setupDLQ(): void {
    this.deadLetterQueueService.registerDLQ('swaps', {
      maxRetries: 3,
      retentionDays: 30,
    });
  }

  async executeSwap(swapData: {
    userId: string;
    fromToken: string;
    toToken: string;
    amount: number;
  }): Promise<any> {
    const correlationId = this.correlationIdService.getCorrelationId();

    this.logger.log(
      `[${correlationId}] Executing swap: ${swapData.fromToken} -> ${swapData.toToken}`,
    );

    const steps: SagaStep[] = [
      {
        name: 'lockBalance',
        action: () =>
          this.lockUserBalance(swapData.userId, swapData.fromToken, swapData.amount),
        compensation: (lockId) =>
          this.unlockBalance(swapData.userId, swapData.fromToken, lockId),
      },
      {
        name: 'executeSwap',
        action: () =>
          this.executeSwapViaCircuitBreaker(swapData.fromToken, swapData.toToken, swapData.amount),
        compensation: (swapId) => this.reverseSwap(swapId),
      },
      {
        name: 'updateBalance',
        action: () =>
          this.updateUserBalances(swapData.userId, swapData.fromToken, swapData.toToken, swapData.amount),
        compensation: () =>
          this.revertBalances(swapData.userId, swapData.fromToken),
      },
      {
        name: 'cleanupLocks',
        action: () => this.cleanupLocks(swapData.userId),
      },
    ];

    const result = await this.sagaService.executeSaga(`swap-${swapData.userId}`, steps);

    if (!result.success) {
      const dlqData = {
        ...swapData,
        sagaResult: result,
        failedStep: result.failedStep,
      };

      await this.deadLetterQueueService.sendToDLQ(
        'swaps',
        undefined,
        'executeSwap',
        dlqData,
        result.error!,
        1,
      );

      this.logger.error(
        `[${correlationId}] Swap failed at step: ${result.failedStep}`,
      );

      throw new Error(`Swap failed: ${result.failedStep}`);
    }

    this.logger.log(
      `[${correlationId}] Swap completed successfully in ${result.executionTimeMs}ms`,
    );

    return result;
  }

  private async lockUserBalance(
    userId: string,
    token: string,
    amount: number,
  ): Promise<string> {
    // Lock logic
    return `lock_${Date.now()}`;
  }

  private async unlockBalance(
    userId: string,
    token: string,
    lockId: string,
  ): Promise<void> {
    // Unlock logic
  }

  private async executeSwapViaCircuitBreaker(
    fromToken: string,
    toToken: string,
    amount: number,
  ): Promise<string> {
    return this.circuitBreakerService.execute(
      'dex-swap',
      () => this.callDexAPI(fromToken, toToken, amount),
    );
  }

  private async callDexAPI(
    fromToken: string,
    toToken: string,
    amount: number,
  ): Promise<string> {
    // DEX API call
    return `swap_${Date.now()}`;
  }

  private async reverseSwap(swapId: string): Promise<void> {
    // Reverse swap logic
  }

  private async updateUserBalances(
    userId: string,
    fromToken: string,
    toToken: string,
    amount: number,
  ): Promise<void> {
    // Update balances
  }

  private async revertBalances(userId: string, fromToken: string): Promise<void> {
    // Revert balances
  }

  private async cleanupLocks(userId: string): Promise<void> {
    // Cleanup locks
  }
}

/**
 * Example 5: Composing Multiple Patterns
 */
@Injectable()
export class ResilientTradingService {
  private readonly logger = new Logger(ResilientTradingService.name);

  constructor(
    private externalApiClient: ResilientExternalApiClient,
    private databaseService: ResilientDatabaseService,
    private jobProcessor: ResilientJobProcessor,
    private swapService: ResilientSwapService,
    private errorMonitoringService: ErrorMonitoringService,
    private correlationIdService: CorrelationIdService,
  ) {}

  async executeTrade(tradeData: any): Promise<any> {
    const correlationId = this.correlationIdService.getCorrelationId();

    try {
      this.logger.log(
        `[${correlationId}] Starting trade execution for user ${tradeData.userId}`,
      );

      // 1. Get token prices using resilient API client
      const prices = await Promise.all([
        this.externalApiClient.getTokenPrice(tradeData.fromToken),
        this.externalApiClient.getTokenPrice(tradeData.toToken),
      ]);

      // 2. Check user balance using resilient database service
      const user = await this.databaseService.queryUser(tradeData.userId);

      if (user.balance < tradeData.amount) {
        throw new Error('Insufficient balance');
      }

      // 3. Execute swap using saga pattern
      const swapResult = await this.swapService.executeSwap({
        userId: tradeData.userId,
        fromToken: tradeData.fromToken,
        toToken: tradeData.toToken,
        amount: tradeData.amount,
      });

      // 4. Process notification asynchronously
      await this.jobProcessor.processNotification({
        jobId: `notif_${Date.now()}`,
        userId: tradeData.userId,
        type: 'trade_completed',
        data: swapResult,
      });

      return swapResult;
    } catch (error) {
      // Record error for monitoring
      this.errorMonitoringService.recordError(
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId,
          userId: tradeData.userId,
          endpoint: '/api/trades',
          severity: 'MEDIUM' as any,
        },
      );

      throw error;
    }
  }
}

export default {
  ResilientExternalApiClient,
  ResilientDatabaseService,
  ResilientJobProcessor,
  ResilientSwapService,
  ResilientTradingService,
};
