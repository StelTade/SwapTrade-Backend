import { Injectable, Inject, Optional } from '@nestjs/common';
import { Request } from 'express';
import { LoggerService } from './logger_service';
import { categorizeError, getErrorDetails, ErrorCategory } from '../exceptions/error-codes';
import { ConfigService } from '../../config/config.service';
import { AuditLoggerService } from './audit-logger.service';

export interface ErrorLog {
  timestamp: string;
  errorCode: string;
  errorCategory: ErrorCategory;
  message: string;
  statusCode: number;
  method: string;
  url: string;
  userId?: string;
  correlationId?: string;
  stack?: string;
  request?: {
    headers?: Record<string, any>;
    body?: any;
    query?: any;
  };
  metadata?: Record<string, any>;
}

/**
 * Specialized error logging service
 * Logs errors with categorization, tracking, and monitoring capabilities
 */
@Injectable()
export class ErrorLoggerService {
  constructor(
    @Optional() @Inject('LoggerService')
    private readonly logger?: LoggerService,
    private readonly configService?: ConfigService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  /**
   * Log an error with comprehensive context
   */
  logError(
    error: any,
    request?: Request,
    statusCode: number = 500,
    errorCode?: string,
    metadata?: Record<string, any>,
  ): void {
    try {
      const errorLog = this.buildErrorLog(
        error,
        request,
        statusCode,
        errorCode,
        metadata,
      );

      // Log to logger service if available
      if (this.logger) {
        this.logger.error(
          'Application Error',
          errorLog.stack,
          {
            correlationId: errorLog.correlationId,
            userId: errorLog.userId,
            method: errorLog.method,
            url: errorLog.url,
            statusCode: errorLog.statusCode,
            errorCode: errorLog.errorCode,
            errorCategory: errorLog.errorCategory,
          },
        );
      }

      // Always log to console as fallback
      console.error(JSON.stringify(errorLog, null, 2));

      // Track error metrics
      this.trackErrorMetrics(errorLog);

      // Alert on critical errors
      if (this.isCriticalError(statusCode)) {
        this.alertCriticalError(errorLog);
      }

      // Audit critical security errors
      if (this.auditLogger && (statusCode === 401 || statusCode === 403 || statusCode >= 500)) {
        this.auditLogger.log({
          action: 'SYSTEM_ERROR',
          resource: 'SYSTEM',
          status: 'FAILURE',
          metadata: { errorCode, statusCode, message: errorLog.message },
          userId: errorLog.userId,
          ip: (request as any)?.ip
        }).catch(e => console.error('Failed to audit error', e));
      }
    } catch (loggingError) {
      console.error('Error while logging error:', loggingError);
    }
  }

  /**
   * Build comprehensive error log object
   */
  private buildErrorLog(
    error: any,
    request?: Request,
    statusCode: number = 500,
    errorCode?: string,
    metadata?: Record<string, any>,
  ): ErrorLog {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    // Extract error code from custom exception or use provided
    const code =
      errorCode ||
      (error?.errorCode) ||
      (error?.response?.error?.code) ||
      'UNKNOWN_ERROR';

    const errorDetails = getErrorDetails(code);
    const category = categorizeError(code);

    // Extract request context
    const userId = (request as any)?.user?.id || (request as any)?.userId;
    const correlationId =
      (request as any)?.correlationId ||
      (request?.headers as any)?.['x-correlation-id'];

    return {
      timestamp: new Date().toISOString(),
      errorCode: code,
      errorCategory: category,
      message: message || errorDetails.message,
      statusCode,
      method: request?.method || 'UNKNOWN',
      url: request?.url || 'UNKNOWN',
      userId,
      correlationId,
      stack: !this.configService?.isProduction() ? stack : undefined,
      request: {
        headers: this.sanitizeHeaders(request?.headers),
        body: this.sanitizeBody(request?.body),
        query: request?.query,
      },
      metadata,
    };
  }

  /**
   * Track error metrics for monitoring
   */
  private trackErrorMetrics(errorLog: ErrorLog): void {
    // In production, send to monitoring service (e.g., DataDog, Sentry, etc.)
    const metrics = {
      'error.count': 1,
      'error.category': errorLog.errorCategory,
      'error.status': errorLog.statusCode,
    };

    if (this.logger) {
      this.logger.debug('Error metrics', {
        ...metrics,
        correlationId: errorLog.correlationId,
      });
    }
  }

  /**
   * Alert on critical errors
   */
  private alertCriticalError(errorLog: ErrorLog): void {
    // Critical errors: 500+ status codes
    const isCritical = errorLog.statusCode >= 500;

    if (isCritical) {
      console.error('⚠️ CRITICAL ERROR:', {
        code: errorLog.errorCode,
        message: errorLog.message,
        statusCode: errorLog.statusCode,
        timestamp: errorLog.timestamp,
        url: errorLog.url,
        correlationId: errorLog.correlationId,
      });

      // In production, send alert to monitoring service
      if (this.configService?.isProduction()) {
        // TODO: Integrate with alerting service (PagerDuty, Slack, etc.)
      }
    }
  }

  /**
   * Check if error is critical (500+ status)
   */
  private isCriticalError(statusCode: number): boolean {
    return statusCode >= 500;
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers?: Record<string, any>): Record<string, any> {
    if (!headers) return {};

    const sensitiveFields = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'password',
    ];

    const sanitized = { ...headers };
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body?: any): any {
    if (!body) return undefined;

    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'creditCard',
      'ssn',
    ];

    const sanitized = JSON.parse(JSON.stringify(body));

    const sanitizeObject = (obj: any) => {
      for (const key in obj) {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Log unhandled promise rejection
   */
  logUnhandledRejection(reason: any, promise: Promise<any>): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      errorCode: 'UNHANDLED_REJECTION',
      errorCategory: ErrorCategory.INTERNAL,
      message: `Unhandled Promise Rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
      statusCode: 500,
      method: 'ASYNC',
      url: 'N/A',
      stack: reason instanceof Error ? reason.stack : undefined,
    };

    if (this.logger) {
      this.logger.error(
        'Unhandled Promise Rejection',
        reason instanceof Error ? reason.stack : String(reason),
        { errorCode: 'UNHANDLED_REJECTION' },
      );
    }

    console.error('⚠️ UNHANDLED PROMISE REJECTION:', JSON.stringify(errorLog, null, 2));
    this.alertCriticalError(errorLog);
  }

  /**
   * Log uncaught exception
   */
  logUncaughtException(error: Error): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      errorCode: 'UNCAUGHT_EXCEPTION',
      errorCategory: ErrorCategory.INTERNAL,
      message: `Uncaught Exception: ${error.message}`,
      statusCode: 500,
      method: 'SYNC',
      url: 'N/A',
      stack: error.stack,
    };

    if (this.logger) {
      this.logger.error(
        'Uncaught Exception',
        error.stack,
        { errorCode: 'UNCAUGHT_EXCEPTION' },
      );
    }

    console.error('⚠️ UNCAUGHT EXCEPTION:', JSON.stringify(errorLog, null, 2));
    this.alertCriticalError(errorLog);
  }
}
