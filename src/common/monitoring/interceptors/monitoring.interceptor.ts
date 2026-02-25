import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PrometheusService } from '../services/prometheus.service';
import { OpenTelemetryService } from '../services/opentelemetry.service';
import { StructuredLoggerService } from '../services/structured-logger.service';
import { CorrelationContext } from '../interfaces/monitoring.interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(
    private readonly prometheusService: PrometheusService,
    private readonly telemetryService: OpenTelemetryService,
    private readonly logger: StructuredLoggerService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Generate correlation ID if not present
    const correlationId = request.headers['x-correlation-id'] || uuidv4();
    request.correlationId = correlationId;

    // Extract trace context from headers
    const traceContext = this.telemetryService.extractTraceContext(request.headers);
    
    // Create correlation context
    const correlationContext: CorrelationContext = {
      correlationId,
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      userId: request.user?.id,
      requestId: request.id,
      sessionId: request.session?.id
    };

    // Start tracing span
    const span = this.telemetryService.startSpan(
      `${request.method} ${request.route?.path || request.url}`,
      undefined,
      {
        'http.method': request.method,
        'http.url': request.url,
        'user.id': request.user?.id || 'anonymous',
        'correlation.id': correlationId
      }
    );

    // Log request start
    this.logger.logWithCorrelation(
      'info',
      `Request started: ${request.method} ${request.url}`,
      correlationId,
      {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        userId: request.user?.id
      }
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Record metrics
        this.prometheusService.recordHttpRequest(
          request.method,
          request.route?.path || request.url,
          statusCode,
          duration
        );

        // Record trace
        this.telemetryService.traceHttpResponse(
          request.method,
          request.route?.path || request.url,
          statusCode,
          duration,
          request.user?.id
        );

        // Log request completion
        this.logger.logWithCorrelation(
          'info',
          `Request completed: ${request.method} ${request.url} - ${statusCode}`,
          correlationId,
          {
            method: request.method,
            url: request.url,
            statusCode,
            duration
          },
          undefined,
          duration
        );

        // End span
        span.end();
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Record error metrics
        this.prometheusService.recordHttpRequest(
          request.method,
          request.route?.path || request.url,
          statusCode,
          duration
        );

        // Record error trace
        span.setStatus({
          code: 2, // ERROR
          message: error.message
        });
        span.recordException(error);
        span.end();

        // Log error
        this.logger.logWithCorrelation(
          'error',
          `Request failed: ${request.method} ${request.url} - ${statusCode}`,
          correlationId,
          {
            method: request.method,
            url: request.url,
            statusCode,
            duration,
            error: error.message
          },
          error,
          duration
        );

        // Re-throw the error
        throw error;
      })
    );
  }
}
