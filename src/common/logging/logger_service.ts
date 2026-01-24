// src/common/logging/logger.service.ts
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  tradeId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  [key: string]: any;
}

export interface AuditLogData {
  action: string;
  resource: string;
  resourceId: string;
  userId: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private asyncLocalStorage: AsyncLocalStorage<Map<string, any>>;
  private static sensitiveFields = [
    'password',
    'token',
    'apiKey',
    'secret',
    'authorization',
    'cookie',
    'creditCard',
    'ssn',
  ];

  constructor() {
    this.asyncLocalStorage = new AsyncLocalStorage();
    
    const customFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(this.formatLog.bind(this)),
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: customFormat,
      transports: [
        // Console transport for all logs
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            customFormat,
          ),
        }),
        // File transport for errors
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 7,
          tailable: true,
        }),
        // File transport for all logs
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 7,
          tailable: true,
        }),
        // Separate file for audit logs
        new winston.transports.File({
          filename: 'logs/audit.log',
          maxsize: 10485760, // 10MB
          maxFiles: 30, // Keep audit logs longer
          tailable: true,
        }),
      ],
    });
  }

  private formatLog(info: winston.Logform.TransformableInfo): string {
    const context = this.getContext();
    const logObject: any = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      correlationId: context.get('correlationId'),
      ...this.maskSensitiveData(info.context || {}),
    };

    if (info.stack) {
      logObject.stack = info.stack;
    }

    return JSON.stringify(logObject);
  }

  private maskSensitiveData(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const masked = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in masked) {
      const lowerKey = key.toLowerCase();
      
      if (LoggerService.sensitiveFields.some(field => lowerKey.includes(field))) {
        masked[key] = '***REDACTED***';
      } else if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    }

    return masked;
  }

  private getContext(): Map<string, any> {
    return this.asyncLocalStorage.getStore() || new Map();
  }

  setContext(key: string, value: any): void {
    const store = this.getContext();
    store.set(key, value);
  }

  runWithContext<T>(callback: () => T): T {
    return this.asyncLocalStorage.run(new Map(), callback);
  }

  log(message: string, context?: LogContext): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: LogContext): void {
    this.logger.error(message, { context, stack: trace });
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: LogContext): void {
    this.logger.verbose(message, { context });
  }

  audit(data: AuditLogData): void {
    const context = this.getContext();
    const auditLog = {
      type: 'AUDIT',
      timestamp: new Date().toISOString(),
      correlationId: context.get('correlationId'),
      ...this.maskSensitiveData(data),
    };

    this.logger.info('Audit Log', { context: auditLog });
  }

  metric(name: string, value: number, tags?: Record<string, string>): void {
    const context = this.getContext();
    const metricLog = {
      type: 'METRIC',
      name,
      value,
      tags,
      correlationId: context.get('correlationId'),
      timestamp: new Date().toISOString(),
    };

    this.logger.info('Metric', { context: metricLog });
  }
}