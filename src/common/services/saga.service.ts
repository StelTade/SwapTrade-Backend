import { Injectable, Logger } from '@nestjs/common';
import { CorrelationIdService } from './correlation-id.service';

/**
 * Saga step function
 */
export type SagaStepFn<T = any> = () => Promise<T>;

/**
 * Saga compensation function (rollback)
 */
export type SagaCompensationFn<T = any> = (stepResult: T) => Promise<void>;

/**
 * Saga step definition
 */
export interface SagaStep<T = any> {
  name: string;
  action: SagaStepFn<T>;
  compensation?: SagaCompensationFn<T>;
}

/**
 * Saga execution result
 */
export interface SagaResult {
  success: boolean;
  completedSteps: string[];
  failedStep?: string;
  error?: Error;
  compensatedSteps: string[];
  totalSteps: number;
  executionTimeMs: number;
}

/**
 * Service for implementing Saga pattern for distributed transactions
 * Handles complex operations with automatic rollback on failure
 */
@Injectable()
export class SagaService {
  private readonly logger = new Logger(SagaService.name);

  constructor(private readonly correlationIdService: CorrelationIdService) {}

  /**
   * Execute a saga (sequence of steps with compensations)
   */
  async executeSaga(
    sagaName: string,
    steps: SagaStep[],
  ): Promise<SagaResult> {
    const correlationId = this.correlationIdService.getCorrelationId();
    const startTime = Date.now();
    const completedSteps: string[] = [];
    const compensatedSteps: string[] = [];
    const stepResults = new Map<string, any>();

    this.logger.log(
      `[${correlationId}] Starting saga: ${sagaName} with ${steps.length} steps`,
    );

    try {
      // Execute all steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        try {
          this.logger.debug(
            `[${correlationId}] Executing saga step [${i + 1}/${steps.length}]: ${step.name}`,
          );

          const result = await this.executeWithTimeout(step.action);
          stepResults.set(step.name, result);
          completedSteps.push(step.name);

          this.logger.debug(`[${correlationId}] Saga step completed: ${step.name}`);
        } catch (error) {
          this.logger.error(
            `[${correlationId}] Saga step failed: ${step.name} - ${
              error instanceof Error ? error.message : error
            }`,
          );

          // Start compensating for already completed steps
          await this.compensate(
            sagaName,
            steps.slice(0, i),
            stepResults,
            compensatedSteps,
            correlationId,
          );

          const executionTimeMs = Date.now() - startTime;
          return {
            success: false,
            completedSteps,
            failedStep: step.name,
            error: error instanceof Error ? error : new Error(String(error)),
            compensatedSteps,
            totalSteps: steps.length,
            executionTimeMs,
          };
        }
      }

      const executionTimeMs = Date.now() - startTime;
      this.logger.log(
        `[${correlationId}] Saga completed successfully: ${sagaName} (${executionTimeMs}ms)`,
      );

      return {
        success: true,
        completedSteps,
        compensatedSteps,
        totalSteps: steps.length,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      return {
        success: false,
        completedSteps,
        compensatedSteps,
        error: error instanceof Error ? error : new Error(String(error)),
        totalSteps: steps.length,
        executionTimeMs,
      };
    }
  }

  /**
   * Execute parallel steps with saga semantics
   */
  async executeParallelSteps(
    sagaName: string,
    steps: SagaStep[],
  ): Promise<SagaResult> {
    const correlationId = this.correlationIdService.getCorrelationId();
    const startTime = Date.now();
    const stepResults = new Map<string, any>();
    const compensatedSteps: string[] = [];

    this.logger.log(
      `[${correlationId}] Starting parallel saga: ${sagaName} with ${steps.length} steps`,
    );

    try {
      // Execute all steps in parallel
      const promises = steps.map(async (step) => {
        try {
          this.logger.debug(
            `[${correlationId}] Executing parallel saga step: ${step.name}`,
          );

          const result = await this.executeWithTimeout(step.action);
          stepResults.set(step.name, result);

          this.logger.debug(`[${correlationId}] Parallel saga step completed: ${step.name}`);

          return { success: true, stepName: step.name };
        } catch (error) {
          this.logger.error(
            `[${correlationId}] Parallel saga step failed: ${step.name} - ${
              error instanceof Error ? error.message : error
            }`,
          );

          return {
            success: false,
            stepName: step.name,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      });

      const results = await Promise.all(promises);

      // Check if any step failed
      const failedResult = results.find((r) => !r.success);
      if (failedResult) {
        // Compensate all steps
        await this.compensate(
          sagaName,
          steps,
          stepResults,
          compensatedSteps,
          correlationId,
        );

        const executionTimeMs = Date.now() - startTime;
        return {
          success: false,
          completedSteps: results.filter((r) => r.success).map((r) => r.stepName),
          failedStep: failedResult.stepName,
          error: failedResult.error,
          compensatedSteps,
          totalSteps: steps.length,
          executionTimeMs,
        };
      }

      const executionTimeMs = Date.now() - startTime;
      this.logger.log(
        `[${correlationId}] Parallel saga completed successfully: ${sagaName} (${executionTimeMs}ms)`,
      );

      return {
        success: true,
        completedSteps: results.map((r) => r.stepName),
        compensatedSteps,
        totalSteps: steps.length,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      return {
        success: false,
        completedSteps: [],
        compensatedSteps,
        error: error instanceof Error ? error : new Error(String(error)),
        totalSteps: steps.length,
        executionTimeMs,
      };
    }
  }

  /**
   * Compensate (rollback) completed steps in reverse order
   */
  private async compensate(
    sagaName: string,
    completedSteps: SagaStep[],
    stepResults: Map<string, any>,
    compensatedSteps: string[],
    correlationId: string,
  ): Promise<void> {
    this.logger.warn(
      `[${correlationId}] Starting compensation for saga: ${sagaName}`,
    );

    // Execute compensations in reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const step = completedSteps[i];
      if (!step.compensation) {
        this.logger.warn(
          `[${correlationId}] No compensation defined for step: ${step.name}`,
        );
        continue;
      }

      try {
        const stepResult = stepResults.get(step.name);
        this.logger.debug(
          `[${correlationId}] Compensating step: ${step.name}`,
        );

        await this.executeWithTimeout(() => step.compensation!(stepResult));
        compensatedSteps.push(step.name);

        this.logger.debug(
          `[${correlationId}] Step compensated: ${step.name}`,
        );
      } catch (error) {
        this.logger.error(
          `[${correlationId}] Compensation failed for step ${step.name}: ${
            error instanceof Error ? error.message : error
          }`,
        );
        // Continue compensating other steps despite this failure
      }
    }

    this.logger.warn(
      `[${correlationId}] Compensation completed for saga: ${sagaName}`,
    );
  }

  /**
   * Execute function with timeout
   */
  private executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number = 30000,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Saga step timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }
}
