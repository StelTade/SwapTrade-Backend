// src/common/middleware/logging.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../logging/logger_service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

    // Store correlation ID in request and response headers
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    // Run the rest of the request within async context
    this.logger.runWithContext(() => {
      this.logger.setContext('correlationId', correlationId);

      // Extract user ID from request (adjust based on your auth setup)
      const userId = (req as any).user?.id || req.headers['x-user-id'];
      if (userId) {
        this.logger.setContext('userId', userId);
      }

      // Log incoming request
      this.logger.log('Incoming request', {
        correlationId,
        method: req.method,
        url: req.originalUrl,
        userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Capture response
      const originalSend = res.send;
      res.send = function (data: any): Response {
        res.send = originalSend;
        return res.send(data);
      };

      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 500 ? 'error' : 
                        res.statusCode >= 400 ? 'warn' : 'log';

        const logContext: any = {
          correlationId,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          userId,
        };

        if (logLevel === 'error') {
          this.logger.error('Request completed', undefined, logContext);
        } else if (logLevel === 'warn') {
          this.logger.warn('Request completed', logContext);
        } else {
          this.logger.log('Request completed', logContext);
        }

        // Log performance metric
        this.logger.metric('http.request.duration', duration, {
          method: req.method,
          route: req.route?.path || req.originalUrl,
          statusCode: res.statusCode.toString(),
        });

        // Alert on slow requests (> 1 second)
        if (duration > 1000) {
          this.logger.warn('Slow request detected', {
            correlationId,
            method: req.method,
            url: req.originalUrl,
            duration,
          });
        }
      });

      next();
    });
  }
}