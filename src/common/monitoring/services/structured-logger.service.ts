import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { 
  StructuredLogEntry, 
  CorrelationContext, 
  LogConfig,
  MonitoringConfig 
} from '../interfaces/monitoring.interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly serviceName = 'swaptrade-backend';
  private readonly serviceVersion = process.env.APP_VERSION || '1.0.0';
  private readonly environment = process.env.NODE_ENV || 'development';
  private config: LogConfig;

  constructor(config?: MonitoringConfig) {
    this.config = config?.logging || this.getDefaultConfig();
  }

  private getDefaultConfig(): LogConfig {
    return {
      level: LogLevel.INFO,
      format: 'json',
      correlationId: true,
      structured: true,
      console: true,
      file: {
        enabled: true,
        path: './logs/app.log',
        maxSize: '100MB',
        maxFiles: 10
      }
    };
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: CorrelationContext,
    metadata?: Record<string, any>,
    error?: Error,
    duration?: number
  ): StructuredLogEntry {
    const timestamp = new Date().toISOString();
    const correlationContext = this.ensureCorrelationContext(context);

    const logEntry: StructuredLogEntry = {
      timestamp,
      level,
      message,
      context: correlationContext,
      service: this.serviceName,
      version: this.serviceVersion,
      environment: this.environment,
      metadata,
      duration
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    return logEntry;
  }

  private ensureCorrelationContext(context?: CorrelationContext): CorrelationContext {
    if (!context) {
      return {
        correlationId: uuidv4()
      };
    }

    if (!context.correlationId) {
      context.correlationId = uuidv4();
    }

    return context;
  }

  private log(entry: StructuredLogEntry): void {
    const formattedLog = this.formatLog(entry);
    
    if (this.config.console) {
      this.writeToConsole(formattedLog, entry.level);
    }

    if (this.config.file?.enabled) {
      this.writeToFile(formattedLog);
    }

    if (this.config.external?.enabled) {
      this.sendToExternal(entry);
    }
  }

  private formatLog(entry: StructuredLogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }

    // Text format for development
    const parts = [
      entry.timestamp,
      `[${entry.level.toUpperCase()}]`,
      entry.service,
      entry.context.correlationId,
      entry.message
    ];

    if (entry.duration) {
      parts.push(`(${entry.duration}ms)`);
    }

    if (entry.metadata) {
      parts.push(`| ${JSON.stringify(entry.metadata)}`);
    }

    return parts.join(' ');
  }

  private writeToConsole(formattedLog: string, level: LogLevel): void {
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedLog);
        break;
      case LogLevel.TRACE:
        console.trace(formattedLog);
        break;
      default:
        console.log(formattedLog);
    }
  }

  private writeToFile(formattedLog: string): void {
    // In production, this would use a proper file rotation library
    // For now, we'll just append to the file
    const fs = require('fs');
    const path = require('path');
    
    try {
      const logDir = path.dirname(this.config.file!.path);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(this.config.file!.path, formattedLog + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private sendToExternal(entry: StructuredLogEntry): void {
    // This would integrate with external logging services
    // like Elasticsearch, CloudWatch, or Datadog
    switch (this.config.external?.provider) {
      case 'elasticsearch':
        this.sendToElasticsearch(entry);
        break;
      case 'cloudwatch':
        this.sendToCloudWatch(entry);
        break;
      case 'datadog':
        this.sendToDatadog(entry);
        break;
    }
  }

  private sendToElasticsearch(entry: StructuredLogEntry): void {
    // Implementation for Elasticsearch
    // This would use @elastic/elasticsearch client
  }

  private sendToCloudWatch(entry: StructuredLogEntry): void {
    // Implementation for CloudWatch
    // This would use AWS SDK
  }

  private sendToDatadog(entry: StructuredLogEntry): void {
    // Implementation for Datadog
    // This would use datadog-api-client
  }

  // LoggerService interface methods
  log(message: string, context?: CorrelationContext, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, context, metadata);
    this.log(entry);
  }

  error(message: string, error?: Error, context?: CorrelationContext, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, metadata, error);
    this.log(entry);
  }

  warn(message: string, context?: CorrelationContext, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, context, metadata);
    this.log(entry);
  }

  debug(message: string, context?: CorrelationContext, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context, metadata);
    this.log(entry);
  }

  verbose(message: string, context?: CorrelationContext, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.TRACE, message, context, metadata);
    this.log(entry);
  }

  // Additional methods for structured logging
  logWithCorrelation(
    level: LogLevel,
    message: string,
    correlationId: string,
    metadata?: Record<string, any>,
    error?: Error,
    duration?: number
  ): void {
    const context: CorrelationContext = { correlationId };
    const entry = this.createLogEntry(level, message, context, metadata, error, duration);
    this.log(entry);
  }

  logWithTrace(
    level: LogLevel,
    message: string,
    traceId: string,
    spanId: string,
    metadata?: Record<string, any>,
    error?: Error,
    duration?: number
  ): void {
    const context: CorrelationContext = { 
      correlationId: traceId, 
      traceId, 
      spanId 
    };
    const entry = this.createLogEntry(level, message, context, metadata, error, duration);
    this.log(entry);
  }

  // Performance logging
  logPerformance(
    operation: string,
    duration: number,
    context?: CorrelationContext,
    metadata?: Record<string, any>
  ): void {
    const enhancedMetadata = {
      ...metadata,
      operation,
      performance: true,
      durationMs: duration
    };
    
    const entry = this.createLogEntry(
      LogLevel.INFO, 
      `Performance: ${operation} completed in ${duration}ms`,
      context,
      enhancedMetadata,
      undefined,
      duration
    );
    this.log(entry);
  }

  // Business event logging
  logBusinessEvent(
    event: string,
    userId: string,
    metadata?: Record<string, any>,
    context?: CorrelationContext
  ): void {
    const enhancedContext = {
      ...context,
      userId,
      correlationId: context?.correlationId || uuidv4()
    };

    const enhancedMetadata = {
      ...metadata,
      businessEvent: true,
      event,
      userId
    };

    const entry = this.createLogEntry(
      LogLevel.INFO,
      `Business Event: ${event}`,
      enhancedContext,
      enhancedMetadata
    );
    this.log(entry);
  }

  // Security event logging
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string,
    ip?: string,
    metadata?: Record<string, any>,
    context?: CorrelationContext
  ): void {
    const enhancedContext = {
      ...context,
      userId,
      correlationId: context?.correlationId || uuidv4()
    };

    const enhancedMetadata = {
      ...metadata,
      securityEvent: true,
      event,
      severity,
      userId,
      ip
    };

    const entry = this.createLogEntry(
      LogLevel.WARN,
      `Security Event: ${event} [${severity.toUpperCase()}]`,
      enhancedContext,
      enhancedMetadata
    );
    this.log(entry);
  }
}
