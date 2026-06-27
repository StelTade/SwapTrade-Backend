import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  trace,
  context,
  propagation,
  Span,
  SpanStatusCode,
  SpanKind,
  Context,
  SpanContext,
  isSpanContextValid,
  ROOT_CONTEXT,
} from '@opentelemetry/api';
import type { TraceConfig } from '../interfaces/monitoring.interfaces';
import { CorrelationContext } from '../interfaces/monitoring.interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * OpenTelemetryService
 *
 * Thin NestJS wrapper around the OTel API. The SDK itself is bootstrapped
 * in src/tracing.ts before the application starts. This service provides
 * ergonomic helpers for creating spans, propagating context across HTTP
 * boundaries, and tracing database / external API / business operations.
 *
 * All span creation goes through startActiveSpan() so child spans are
 * automatically parented to the current active span in the async context.
 */
@Injectable()
export class OpenTelemetryService implements OnModuleDestroy {
  private readonly logger = new Logger(OpenTelemetryService.name);
  private readonly config: TraceConfig;

  constructor(config?: TraceConfig) {
    this.config = config ?? this.getDefaultConfig();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async onModuleDestroy(): Promise<void> {
    // The SDK shutdown is handled in tracing.ts via SIGTERM.
    // Nothing to do here; the service is stateless.
  }

  // ---------------------------------------------------------------------------
  // Configuration helpers
  // ---------------------------------------------------------------------------

  private getDefaultConfig(): TraceConfig {
    return {
      enabled: process.env.OTEL_ENABLED === 'true',
      samplingRate: parseFloat(process.env.OTEL_SAMPLING_RATE ?? '1.0'),
      exportInterval: parseInt(process.env.OTEL_EXPORT_INTERVAL ?? '5000', 10),
      headers: {},
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'swaptrade-backend',
      serviceVersion:
        process.env.OTEL_SERVICE_VERSION ?? process.env.APP_VERSION ?? '1.0.0',
      environment: process.env.NODE_ENV ?? 'development',
    };
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  // ---------------------------------------------------------------------------
  // Tracer
  // ---------------------------------------------------------------------------

  private get tracer() {
    return trace.getTracer(this.config.serviceName, this.config.serviceVersion);
  }

  // ---------------------------------------------------------------------------
  // Core span helpers (use startActiveSpan so children are auto-parented)
  // ---------------------------------------------------------------------------

  /**
   * Execute `fn` inside a new active span. The span is automatically ended
   * (with OK or ERROR status) when the returned promise resolves/rejects.
   */
  async traceAsync<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    kind: SpanKind = SpanKind.INTERNAL,
    attributes?: Record<string, string>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      name,
      { kind, attributes: this.enrichAttributes(attributes) },
      async (span) => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error: any) {
          this.recordError(span, error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Synchronous variant of traceAsync.
   */
  traceSync<T>(
    name: string,
    fn: (span: Span) => T,
    kind: SpanKind = SpanKind.INTERNAL,
    attributes?: Record<string, string>,
  ): T {
    return this.tracer.startActiveSpan(
      name,
      { kind, attributes: this.enrichAttributes(attributes) },
      (span) => {
        try {
          const result = fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error: any) {
          this.recordError(span, error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Start a span and return it. Caller is responsible for calling span.end().
   * Prefer traceAsync / traceSync when possible; use this only when you need
   * fine-grained control (e.g. streaming responses).
   *
   * NOTE: this does NOT make the span "active" in the context — use
   *       traceAsync / traceSync if you need child-span propagation.
   */
  startSpan(
    name: string,
    kind: SpanKind = SpanKind.INTERNAL,
    attributes?: Record<string, string>,
  ): Span {
    return this.tracer.startSpan(name, {
      kind,
      attributes: this.enrichAttributes(attributes),
    });
  }

  /**
   * Start an active span from an explicit parent context (useful when the
   * parent context was propagated over a message queue or background job).
   */
  startActiveSpanWithContext<T>(
    name: string,
    parentContext: Context,
    fn: (span: Span) => T,
    kind: SpanKind = SpanKind.INTERNAL,
    attributes?: Record<string, string>,
  ): T {
    return this.tracer.startActiveSpan(
      name,
      { kind, attributes: this.enrichAttributes(attributes) },
      parentContext,
      fn,
    );
  }

  // ---------------------------------------------------------------------------
  // Context helpers
  // ---------------------------------------------------------------------------

  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  getCurrentContext(): CorrelationContext {
    const span = this.getCurrentSpan();
    if (!span) {
      return { correlationId: uuidv4() };
    }
    const ctx = span.spanContext();
    return {
      correlationId: ctx.traceId,
      traceId: ctx.traceId,
      spanId: ctx.spanId,
    };
  }

  /**
   * Inject W3C `traceparent` + `tracestate` headers into an outgoing carrier
   * (e.g. an axios request config headers object) so the remote service can
   * continue the distributed trace.
   */
  injectTraceContext(carrier: Record<string, string>): void {
    propagation.inject(context.active(), carrier);
  }

  /**
   * Extract a trace context from inbound headers and return the OTel Context
   * so it can be used as the parent for new spans.
   */
  extractContext(headers: Record<string, string | string[]>): Context {
    // Normalise header values to string (express may give string[])
    const normalised: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalised[key] = Array.isArray(value) ? value[0] : value;
    }
    return propagation.extract(ROOT_CONTEXT, normalised);
  }

  /**
   * Extract trace correlation IDs from inbound headers.
   * Used by MonitoringInterceptor to populate CorrelationContext.
   */
  extractTraceContext(
    headers: Record<string, string | string[]>,
  ): CorrelationContext {
    const extracted = this.extractContext(headers);
    const span = trace.getSpan(extracted);

    if (span) {
      const ctx = span.spanContext();
      if (isSpanContextValid(ctx)) {
        return {
          correlationId: ctx.traceId,
          traceId: ctx.traceId,
          spanId: ctx.spanId,
        };
      }
    }

    // Fall back to manual header parsing for legacy / non-standard clients
    const raw = headers['traceparent'] ?? headers['x-trace-id'];
    const rawStr = Array.isArray(raw) ? raw[0] : raw;
    if (rawStr) {
      const parts = rawStr.split('-');
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

  /**
   * Build outbound W3C traceparent + custom headers for use in log enrichment
   * or manual context propagation.
   */
  getTraceContext(): Record<string, string> {
    const carrier: Record<string, string> = {};
    this.injectTraceContext(carrier);

    const span = this.getCurrentSpan();
    if (span) {
      const ctx = span.spanContext();
      carrier['x-trace-id'] = ctx.traceId;
      carrier['x-span-id'] = ctx.spanId;
    }
    return carrier;
  }

  // ---------------------------------------------------------------------------
  // Domain-specific tracing helpers
  // ---------------------------------------------------------------------------

  /**
   * Trace an inbound HTTP request span (SERVER kind).
   * The MonitoringInterceptor calls this; it wraps the handler execution
   * inside an active span so all downstream DB / external-call spans are
   * automatically nested.
   */
  traceHttpResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
  ): void {
    const span = this.tracer.startSpan(`HTTP ${method} ${path}`, {
      kind: SpanKind.SERVER,
      attributes: this.enrichAttributes({
        'http.method': method,
        'http.target': path,
        'http.status_code': statusCode.toString(),
        'http.response.duration_ms': duration.toString(),
        ...(userId ? { 'user.id': userId } : {}),
      }),
    });

    if (statusCode >= 500) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${statusCode}`,
      });
    }

    span.end();
  }

  /**
   * Trace an outbound HTTP request span (CLIENT kind).
   */
  traceHttpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
  ): void {
    const span = this.tracer.startSpan(`HTTP client ${method}`, {
      kind: SpanKind.CLIENT,
      attributes: this.enrichAttributes({
        'http.method': method,
        'http.url': url,
        'http.status_code': statusCode.toString(),
        'http.request.duration_ms': duration.toString(),
      }),
    });

    if (statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${statusCode}`,
      });
    }

    span.end();
  }

  /**
   * Trace a database query. Attaches the sanitised statement and operation
   * type as span attributes following OTel semantic conventions.
   */
  traceDatabaseQuery(
    query: string,
    dbSystem: string,
    duration: number,
    error?: Error,
    operation?: string,
    table?: string,
  ): void {
    const attrs: Record<string, string> = {
      'db.system': dbSystem,
      'db.statement': this.sanitiseSql(query),
      'db.query.duration_ms': duration.toString(),
    };
    if (operation) attrs['db.operation'] = operation;
    if (table) attrs['db.sql.table'] = table;

    const span = this.tracer.startSpan(
      operation ? `${dbSystem} ${operation}` : 'db.query',
      { kind: SpanKind.CLIENT, attributes: this.enrichAttributes(attrs) },
    );

    if (error) {
      this.recordError(span, error);
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  }

  /**
   * Start a long-lived business operation span. Caller must call span.end().
   * Use traceAsync instead wherever the operation boundary is well-defined.
   */
  traceBusinessOperation(
    operation: string,
    userId?: string,
    amount?: number,
    currency?: string,
    metadata?: Record<string, any>,
  ): Span {
    const attrs: Record<string, string> = {
      'business.operation': operation,
    };
    if (userId) attrs['user.id'] = userId;
    if (amount != null) attrs['business.amount'] = amount.toString();
    if (currency) attrs['business.currency'] = currency;
    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        attrs[`business.${k}`] = String(v);
      }
    }

    return this.tracer.startSpan(`business.${operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: this.enrichAttributes(attrs),
    });
  }

  /**
   * Trace a call to an external third-party service.
   */
  traceExternalServiceCall(
    serviceName: string,
    operation: string,
    duration: number,
    success: boolean,
    error?: Error,
  ): void {
    const span = this.tracer.startSpan(`external.${serviceName}.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: this.enrichAttributes({
        'peer.service': serviceName,
        'external.operation': operation,
        'external.duration_ms': duration.toString(),
        'external.success': success.toString(),
      }),
    });

    if (!success && error) {
      this.recordError(span, error);
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  }

  /**
   * Trace a Bull/Redis message queue job.
   */
  traceMessageProcessing(
    queue: string,
    messageId: string,
    duration: number,
    success: boolean,
    error?: Error,
  ): void {
    const span = this.tracer.startSpan('messaging.process', {
      kind: SpanKind.CONSUMER,
      attributes: this.enrichAttributes({
        'messaging.system': 'bull',
        'messaging.destination': queue,
        'messaging.message_id': messageId,
        'messaging.duration_ms': duration.toString(),
      }),
    });

    if (!success && error) {
      this.recordError(span, error);
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private enrichAttributes(
    attrs?: Record<string, string>,
  ): Record<string, string> {
    return {
      'service.name': this.config.serviceName,
      'service.version': this.config.serviceVersion,
      'deployment.environment': this.config.environment,
      ...attrs,
    };
  }

  private recordError(span: Span, error: any): void {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error?.message ?? String(error),
    });
    span.recordException(error);
  }

  /**
   * Strip bind-parameter values from SQL statements to avoid leaking PII
   * in trace backends. Keeps the query structure for debugging.
   */
  private sanitiseSql(query: string): string {
    // Replace quoted strings and numeric literals with placeholders
    return query
      .replace(/'[^']*'/g, "'?'")
      .replace(/\b\d+\b/g, '?')
      .substring(0, 1024); // cap length for trace attribute limits
  }
}
