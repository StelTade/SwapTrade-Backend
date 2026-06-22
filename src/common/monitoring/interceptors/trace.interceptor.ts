import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { trace, SpanKind, SpanStatusCode, context } from '@opentelemetry/api';
import {
  TRACE_METADATA_KEY,
  TraceOptions,
} from '../decorators/trace.decorator';

/**
 * TraceInterceptor
 *
 * Reads the `@Trace()` / `@TraceMethod()` metadata set by the trace decorators
 * and wraps the handler in a named active span so it appears nested under the
 * root HTTP request span created by MonitoringInterceptor.
 *
 * Register per-controller or per-handler, or globally if you want every
 * decorated method traced automatically.
 *
 * Example:
 *   @UseInterceptors(TraceInterceptor)
 *   @Trace({ name: 'order.create', attributes: { 'order.type': 'limit' } })
 *   async createOrder(...) { ... }
 */
@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const options: TraceOptions | undefined = this.reflector.getAllAndOverride(
      TRACE_METADATA_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    // No @Trace decorator — pass through untouched
    if (!options && options !== null) {
      return next.handle();
    }

    const handler = executionContext.getHandler();
    const className = executionContext.getClass().name;
    const handlerName = handler.name;

    const spanName =
      options?.name ?? `${className}.${handlerName}`;

    const spanKind = this.resolveKind(options?.kind);

    const tracer = trace.getTracer('swaptrade-backend');

    return new Observable((subscriber) => {
      tracer.startActiveSpan(
        spanName,
        {
          kind: spanKind,
          attributes: {
            'code.namespace': className,
            'code.function': handlerName,
            ...options?.attributes,
          },
        },
        (span) => {
          next
            .handle()
            .pipe(
              tap(() => {
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
              }),
              catchError((error) => {
                const shouldIgnore =
                  options?.ignoreExceptions?.some(
                    (ExcType) => error instanceof (ExcType as any),
                  ) ?? false;

                if (!shouldIgnore) {
                  span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error?.message,
                  });
                  span.recordException(error);
                }

                span.end();
                throw error;
              }),
            )
            .subscribe(subscriber);
        },
      );
    });
  }

  private resolveKind(
    kind?: TraceOptions['kind'],
  ): SpanKind {
    switch (kind) {
      case 'SERVER':
        return SpanKind.SERVER;
      case 'CLIENT':
        return SpanKind.CLIENT;
      case 'PRODUCER':
        return SpanKind.PRODUCER;
      case 'CONSUMER':
        return SpanKind.CONSUMER;
      default:
        return SpanKind.INTERNAL;
    }
  }
}
