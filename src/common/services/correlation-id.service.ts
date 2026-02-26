import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

/**
 * Context object stored in AsyncLocalStorage for correlation tracking
 */
export interface CorrelationContext {
  correlationId: string;
  traceId: string;
  userId?: string;
  requestId: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Service for managing correlation IDs and distributed tracing context
 * Uses AsyncLocalStorage to maintain context across async boundaries
 */
@Injectable()
export class CorrelationIdService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

  /**
   * Create a new correlation context
   */
  createContext(userId?: string, metadata?: Record<string, any>): CorrelationContext {
    const context: CorrelationContext = {
      correlationId: uuidv4(),
      traceId: uuidv4(),
      requestId: uuidv4(),
      userId,
      timestamp: Date.now(),
      metadata,
    };
    return context;
  }

  /**
   * Set the current correlation context
   */
  setContext<T>(context: CorrelationContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * Get the current correlation context
   */
  getContext(): CorrelationContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get correlation ID from current context
   */
  getCorrelationId(): string {
    const context = this.getContext();
    return context?.correlationId || 'UNKNOWN';
  }

  /**
   * Get trace ID from current context
   */
  getTraceId(): string {
    const context = this.getContext();
    return context?.traceId || 'UNKNOWN';
  }

  /**
   * Get request ID from current context
   */
  getRequestId(): string {
    const context = this.getContext();
    return context?.requestId || 'UNKNOWN';
  }

  /**
   * Get user ID from current context
   */
  getUserId(): string | undefined {
    const context = this.getContext();
    return context?.userId;
  }

  /**
   * Get all context metadata
   */
  getFullContext(): CorrelationContext | undefined {
    return this.getContext();
  }

  /**
   * Update context metadata
   */
  updateMetadata(metadata: Record<string, any>): void {
    const context = this.getContext();
    if (context) {
      context.metadata = {
        ...context.metadata,
        ...metadata,
      };
    }
  }

  /**
   * Get context as headers for propagation to external services
   */
  getContextHeaders(): Record<string, string> {
    const context = this.getContext();
    if (!context) {
      return {};
    }

    return {
      'x-correlation-id': context.correlationId,
      'x-trace-id': context.traceId,
      'x-request-id': context.requestId,
      ...(context.userId && { 'x-user-id': context.userId }),
    };
  }

  /**
   * Create context from headers (for incoming requests from other services)
   */
  createContextFromHeaders(
    headers: Record<string, string | string[]>,
    userId?: string,
  ): CorrelationContext {
    const correlationId = this.extractHeader(headers, 'x-correlation-id') || uuidv4();
    const traceId = this.extractHeader(headers, 'x-trace-id') || uuidv4();
    const requestId = this.extractHeader(headers, 'x-request-id') || uuidv4();

    return {
      correlationId,
      traceId,
      requestId,
      userId: userId || this.extractHeader(headers, 'x-user-id'),
      timestamp: Date.now(),
    };
  }

  /**
   * Extract header value handling both string and array formats
   */
  private extractHeader(
    headers: Record<string, string | string[]>,
    key: string,
  ): string | undefined {
    const value = headers[key.toLowerCase()];
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value[0];
    }
    return undefined;
  }
}
