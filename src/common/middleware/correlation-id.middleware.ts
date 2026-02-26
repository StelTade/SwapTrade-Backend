import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CorrelationIdService } from '../services/correlation-id.service';

/**
 * Middleware for propagating correlation IDs across requests
 * Extracts or creates correlation context and makes it available
 * throughout the request lifecycle
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  constructor(private readonly correlationIdService: CorrelationIdService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Create context from headers or create new one
    const context = this.correlationIdService.createContextFromHeaders(
      req.headers as Record<string, string>,
      (req as any).user?.id,
    );

    // Execute the request within the context
    this.correlationIdService.setContext(context, () => {
      // Add context headers to response
      const headers = this.correlationIdService.getContextHeaders();
      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
      }

      // Log request
      this.logger.debug(`[${context.correlationId}] ${req.method} ${req.url}`);

      // Add correlation ID to request object for later access
      (req as any).correlationId = context.correlationId;
      (req as any).traceId = context.traceId;
      (req as any).requestId = context.requestId;

      // Add hook to log response
      const originalSend = res.send;

      res.send = function (data: any) {
        const duration = Date.now() - (req as any).startTime;
        const correlationId = this.getHeader('x-correlation-id');

        this.logger.debug(
          `[${correlationId}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`,
        );

        return originalSend.call(this, data);
      };

      (req as any).startTime = Date.now();

      next();
    });
  }
}

/**
 * Middleware for adding correlation context to HTTP clients
 * Can be used with axios, fetch, or other HTTP libraries
 */
export class CorrelationIdHttpInterceptor {
  constructor(private readonly correlationIdService: CorrelationIdService) {}

  /**
   * Get headers to add to outgoing requests
   */
  getHeaders(): Record<string, string> {
    return this.correlationIdService.getContextHeaders();
  }

  /**
   * Add context headers to HTTP config
   */
  addToConfig(config: any): any {
    const headers = this.getHeaders();
    return {
      ...config,
      headers: {
        ...config.headers,
        ...headers,
      },
    };
  }
}
