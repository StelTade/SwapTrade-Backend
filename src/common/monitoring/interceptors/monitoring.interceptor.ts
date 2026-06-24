import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { PrometheusService } from '../services/prometheus.service';
import { OpenTelemetryService } from '../services/opentelemetry.service';
import { StructuredLoggerService } from '../services/structured-logger.service';
import {
  CorrelationContext,
  LogLevel,
} from '../interfaces/monitoring.interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * MonitoringInterceptor
 *
 * Applied globally as APP_INTERCEPTOR. For every inbound HTTP request it:
 *  1. Extracts W3C trace context from headers (enables distributed tracing).
 *  2. Starts a SERVER span as the active span, so all downstream work
 *     (DB queries, external calls) automatically becomes a child span.
 *  3. Records Prometheus metrics for HTTP request rate and duration.
 *  4. Emits structured log entries with correlation IDs on start/end/error.
 *  5. Propagates the traceparent header on the response for the caller.
 */
@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(
    private readonly prometheusService: PrometheusService,
    private readonly telemetryService: OpenTelemetryService,
    private readonly logger: StructuredLoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only instrument HTTP contexts (skip WebSocket / GraphQL subscriptions)
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // -------------------------------------------------------------------------
    // Correlation ID — honour upstream header or generate a new one
    // -------------------------------------------------------------------------
    const correlationId: string =
      (request.headers['x-correlation-id'] as string) ?? uuidv4();
    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    // -------------------------------------------------------------------------
    // Extract W3C trace context from inbound headers
    // -------------------------------------------------------------------------
    const parentCtx = this.telemetryService.extractContext(request.headers);
    const traceCorrelation =
      this.telemetryService.extractTraceContext(request.headers);

    const correlationContext: CorrelationContext = {
      correlationId,
      traceId: traceCorrelation.traceId,
      spanId: traceCorrelation.spanId,
      userId: request.user?.id,
      requestId: request.id,
      sessionId: request.session?.id,
    };

    const spanName = `${request.method} ${request.route?.path ?? request.url}`;

    // -------------------------------------------------------------------------
    // Start an ACTIVE server span parented to the extracted context.
    // Using startActiveSpan ensures every downstream span (TypeORM, Axios, etc.)
    // is automatically nested under this root request span.
    // -------------------------------------------------------------------------
    const tracer = trace.getTracer('swaptrade-backend');
    const span = tracer.startSpan(
      spanName,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': request.method,
          'http.target': request.url,
          'http.scheme': request.protocol ?? 'http',
          'http.user_agent': request.headers['user-agent'] ?? '',
          'http.client_ip': request.ip ?? '',
          'user.id': request.user?.id ?? 'anonymous',
          'correlation.id': correlationId,
        },
      },
      parentCtx,
    );

    // Inject the new span into the async context so all downstream code sees it
    const activeCtx = trace.setSpan(parentCtx, span);

    // Propagate trace headers onto the response
    const outboundCarrier: Record<string, string> = {};
    this.telemetryService.injectTraceContext(outboundCarrier);
    if (outboundCarrier['traceparent']) {
      response.setHeader('traceparent', outboundCarrier['traceparent']);
    }

    // -------------------------------------------------------------------------
    // Log request start
    // -------------------------------------------------------------------------
    this.logger.logWithCorrelation(
      LogLevel.INFO,
      `Request started: ${request.method} ${request.url}`,
      correlationId,
      {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        userId: request.user?.id,
        traceId: traceCorrelation.traceId,
      },
    );

    // Run the handler inside the active span context
    return new Observable((subscriber) => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      // Bind the handler execution to the active span context
      const handlerResult$ = (
        require('@opentelemetry/api').context as typeof import('@opentelemetry/api').context
      ).with(activeCtx, () => next.handle()) as Observable<any>;

      handlerResult$
        .pipe(
          tap(() => {
            const duration = Date.now() - startTime;
            const statusCode: number = response.statusCode;

            // Add HTTP response attributes to the root span
            span.setAttribute('http.status_code', statusCode);
            span.setAttribute('http.response.duration_ms', duration);

            if (statusCode >= 500) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: `HTTP ${statusCode}`,
              });
            } else {
              span.setStatus({ code: SpanStatusCode.OK });
            }
            span.end();

            // Prometheus
            self.prometheusService.recordHttpRequest(
              request.method,
              request.route?.path ?? request.url,
              statusCode,
              duration,
            );

            // Structured log
            self.logger.logWithCorrelation(
              LogLevel.INFO,
              `Request completed: ${request.method} ${request.url} ${statusCode}`,
              correlationId,
              { method: request.method, url: request.url, statusCode, duration },
              undefined,
              duration,
            );
          }),
          catchError((error) => {
            const duration = Date.now() - startTime;
            const statusCode: number = error.status ?? 500;

            span.setAttribute('http.status_code', statusCode);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            span.recordException(error);
            span.end();

            self.prometheusService.recordHttpRequest(
              request.method,
              request.route?.path ?? request.url,
              statusCode,
              duration,
            );

            self.logger.logWithCorrelation(
              LogLevel.ERROR,
              `Request failed: ${request.method} ${request.url} ${statusCode}`,
              correlationId,
              {
                method: request.method,
                url: request.url,
                statusCode,
                duration,
                error: error.message,
              },
              error,
              duration,
            );

            return throwError(() => error);
          }),
        )
        .subscribe(subscriber);
    });
  }
}