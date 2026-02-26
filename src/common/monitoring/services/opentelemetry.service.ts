import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, Span, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { TraceConfig, CorrelationContext } from '../interfaces/monitoring.interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OpenTelemetryService implements OnModuleInit, OnModuleDestroy {
  private sdk: NodeSDK;
  private tracer: any;
  private config: TraceConfig;

  constructor(config?: TraceConfig) {
    this.config = config || this.getDefaultConfig();
    this.sdk = this.initializeSDK();
    this.tracer = trace.getTracer(this.config.serviceName);
  }

  private getDefaultConfig(): TraceConfig {
    return {
      enabled: process.env.OTEL_ENABLED === 'true',
      samplingRate: parseFloat(process.env.OTEL_SAMPLING_RATE || '0.1'),
      exportInterval: parseInt(process.env.OTEL_EXPORT_INTERVAL || '5000'),
      headers: {},
      serviceName: process.env.OTEL_SERVICE_NAME || 'swaptrade-backend',
      serviceVersion: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  private initializeSDK(): NodeSDK {
    if (!this.config.enabled) {
      return null as any;
    }

    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
      }),
      traceExporter: this.createTraceExporter(),
      sampler: this.createSampler(),
    });

    return sdk;
  }

  private createTraceExporter() {
    // Configure based on environment
    const exporterType = process.env.OTEL_EXPORTER_TYPE || 'console';
    
    switch (exporterType) {
      case 'jaeger':
        return this.createJaegerExporter();
      case 'zipkin':
        return this.createZipkinExporter();
      case 'otlp':
        return this.createOTLPExporter();
      default:
        return this.createConsoleExporter();
    }
  }

  private createJaegerExporter() {
    const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
    return new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    });
  }

  private createZipkinExporter() {
    const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
    return new ZipkinExporter({
      url: process.env.ZIPKIN_URL || 'http://localhost:9411/api/v2/spans',
    });
  }

  private createOTLPExporter() {
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-http');
    return new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: this.config.headers,
    });
  }

  private createConsoleExporter() {
    const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
    return new ConsoleSpanExporter();
  }

  private createSampler() {
    const { TraceIdRatioBasedSampler } = require('@opentelemetry/sdk-trace-base');
    return new TraceIdRatioBasedSampler(this.config.samplingRate);
  }

  async onModuleInit() {
    if (this.sdk) {
      this.sdk.start();
    }
  }

  async onModuleDestroy() {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }

  // Tracing methods
  startSpan(name: string, kind?: SpanKind, attributes?: Record<string, string>): Span {
    return this.tracer.startSpan(name, {
      kind: kind || SpanKind.INTERNAL,
      attributes: {
        ...attributes,
        'service.name': this.config.serviceName,
        'service.version': this.config.serviceVersion,
        'environment': this.config.environment,
      },
    });
  }

  async traceAsync<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    kind?: SpanKind,
    attributes?: Record<string, string>
  ): Promise<T> {
    const span = this.startSpan(name, kind, attributes);
    
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  traceSync<T>(
    name: string,
    fn: (span: Span) => T,
    kind?: SpanKind,
    attributes?: Record<string, string>
  ): T {
    const span = this.startSpan(name, kind, attributes);
    
    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Context management
  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  getCurrentContext(): CorrelationContext {
    const span = this.getCurrentSpan();
    if (!span) {
      return { correlationId: uuidv4() };
    }

    const spanContext = span.spanContext();
    return {
      correlationId: spanContext.traceId,
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    };
  }

  // HTTP tracing
  traceHttpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    headers?: Record<string, string>
  ): void {
    const span = this.startSpan('http.request', SpanKind.CLIENT, {
      'http.method': method,
      'http.url': url,
      'http.status_code': statusCode.toString(),
      'http.request.duration_ms': duration.toString(),
    });

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        span.setAttribute(`http.request.header.${key}`, value);
      });
    }

    span.end();
  }

  traceHttpResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
    headers?: Record<string, string>
  ): void {
    const span = this.startSpan('http.response', SpanKind.SERVER, {
      'http.method': method,
      'http.target': path,
      'http.status_code': statusCode.toString(),
      'http.response.duration_ms': duration.toString(),
    });

    if (userId) {
      span.setAttribute('user.id', userId);
    }

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        span.setAttribute(`http.response.header.${key}`, value);
      });
    }

    span.end();
  }

  // Database tracing
  traceDatabaseQuery(
    query: string,
    database: string,
    duration: number,
    error?: Error
  ): void {
    const span = this.startSpan('database.query', SpanKind.CLIENT, {
      'db.system': database,
      'db.statement': query,
      'db.query.duration_ms': duration.toString(),
    });

    if (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
    }

    span.end();
  }

  // Business operation tracing
  traceBusinessOperation(
    operation: string,
    userId?: string,
    amount?: number,
    currency?: string,
    metadata?: Record<string, any>
  ): Span {
    const attributes: Record<string, string> = {
      'business.operation': operation,
    };

    if (userId) {
      attributes['user.id'] = userId;
    }

    if (amount) {
      attributes['business.amount'] = amount.toString();
    }

    if (currency) {
      attributes['business.currency'] = currency;
    }

    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        attributes[`business.${key}`] = String(value);
      });
    }

    return this.startSpan(`business.${operation}`, SpanKind.INTERNAL, attributes);
  }

  // External service tracing
  traceExternalServiceCall(
    serviceName: string,
    operation: string,
    duration: number,
    success: boolean,
    error?: Error
  ): void {
    const span = this.startSpan(`external.${serviceName}.${operation}`, SpanKind.CLIENT, {
      'external.service': serviceName,
      'external.operation': operation,
      'external.duration_ms': duration.toString(),
      'external.success': success.toString(),
    });

    if (!success && error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
    }

    span.end();
  }

  // Message queue tracing
  traceMessageProcessing(
    queue: string,
    messageId: string,
    duration: number,
    success: boolean,
    error?: Error
  ): void {
    const span = this.startSpan('message.processing', SpanKind.CONSUMER, {
      'messaging.system': queue,
      'messaging.message_id': messageId,
      'messaging.duration_ms': duration.toString(),
      'messaging.success': success.toString(),
    });

    if (!success && error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
    }

    span.end();
  }

  // Get trace context for propagation
  getTraceContext(): Record<string, string> {
    const span = this.getCurrentSpan();
    if (!span) {
      return {};
    }

    const spanContext = span.spanContext();
    return {
      'traceparent': `00-${spanContext.traceId}-${spanContext.spanId}-01`,
      'x-trace-id': spanContext.traceId,
      'x-span-id': spanContext.spanId,
    };
  }

  // Extract trace context from headers
  extractTraceContext(headers: Record<string, string>): CorrelationContext {
    const traceparent = headers['traceparent'] || headers['x-trace-id'];
    const spanId = headers['x-span-id'];

    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length >= 3) {
        return {
          correlationId: parts[1],
          traceId: parts[1],
          spanId: parts[2],
        };
      }
    }

    return { correlationId: uuidv4() };
  }
}
