import { HttpService } from '@nestjs/axios';
import {
  trace,
  SpanKind,
  SpanStatusCode,
  propagation,
  context,
} from '@opentelemetry/api';

/**
 * ExternalApiTracingAxiosInterceptor
 *
 * Registers Axios request/response interceptors on a @nestjs/axios HttpService
 * so that every outbound HTTP call is wrapped in an OTel CLIENT span with the
 * W3C `traceparent` header injected for end-to-end context propagation.
 *
 * Usage — call once per HttpService instance (e.g. in onModuleInit):
 *
 *   ExternalApiTracingAxiosInterceptor.register(this.httpService);
 */
export class ExternalApiTracingAxiosInterceptor {
  static register(httpService: HttpService): void {
    const axios = httpService.axiosRef;

    // ── Request interceptor — open a CLIENT span and inject traceparent ────
    axios.interceptors.request.use((config) => {
      const tracer = trace.getTracer('swaptrade-backend');
      const url = config.url ?? 'unknown';
      const method = (config.method ?? 'GET').toUpperCase();

      const span = tracer.startSpan(`HTTP ${method} ${url}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          'http.method': method,
          'http.url': url,
          'peer.service': ExternalApiTracingAxiosInterceptor.extractHost(url),
        },
      });

      // Inject W3C traceparent into outbound headers
      const carrier: Record<string, string> = {};
      propagation.inject(trace.setSpan(context.active(), span), carrier);

      if (!config.headers) config.headers = {} as any;
      Object.assign(config.headers, carrier);

      // Stash for the response interceptor
      (config as any).__otel_span = span;
      (config as any).__otel_start = Date.now();

      return config;
    });

    // ── Response interceptor — close the span ─────────────────────────────
    axios.interceptors.response.use(
      (response) => {
        const span = (response.config as any).__otel_span;
        const start: number =
          (response.config as any).__otel_start ?? Date.now();

        if (span) {
          span.setAttributes({
            'http.status_code': response.status,
            'http.response.duration_ms': Date.now() - start,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
        }

        return response;
      },
      (error) => {
        const cfg = error?.config ?? {};
        const span = cfg.__otel_span;
        const start: number = cfg.__otel_start ?? Date.now();

        if (span) {
          span.setAttributes({
            'http.response.duration_ms': Date.now() - start,
            ...(error.response?.status
              ? { 'http.status_code': error.response.status }
              : {}),
          });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          span.recordException(error);
          span.end();
        }

        return Promise.reject(error);
      },
    );
  }

  private static extractHost(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }
}
