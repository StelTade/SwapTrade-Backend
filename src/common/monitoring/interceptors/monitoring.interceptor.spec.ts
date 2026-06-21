import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringInterceptor } from './monitoring.interceptor';
import { OpenTelemetryService } from '../services/opentelemetry.service';
import { PrometheusService } from '../services/prometheus.service';
import { StructuredLoggerService } from '../services/structured-logger.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { trace, SpanKind } from '@opentelemetry/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeSpanMock = () => ({
  setAttribute: jest.fn(),
  setStatus: jest.fn(),
  recordException: jest.fn(),
  end: jest.fn(),
  spanContext: jest.fn(() => ({
    traceId: 'trace-id-abc',
    spanId: 'span-id-xyz',
    traceFlags: 1,
  })),
});

function buildMockContext(overrides: Partial<any> = {}): ExecutionContext {
  return {
    getType: jest.fn().mockReturnValue('http'),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        method: 'GET',
        url: '/test',
        headers: {},
        ip: '127.0.0.1',
        route: { path: '/test' },
        ...overrides.request,
      }),
      getResponse: jest.fn().mockReturnValue({
        statusCode: 200,
        setHeader: jest.fn(),
        ...overrides.response,
      }),
    }),
  } as unknown as ExecutionContext;
}

function buildCallHandler(obs: any): CallHandler {
  return { handle: jest.fn().mockReturnValue(obs) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MonitoringInterceptor', () => {
  let interceptor: MonitoringInterceptor;
  let spanMock: ReturnType<typeof makeSpanMock>;
  let tracerMock: any;
  let prometheusService: jest.Mocked<PrometheusService>;
  let telemetryService: jest.Mocked<OpenTelemetryService>;
  let loggerService: jest.Mocked<StructuredLoggerService>;

  beforeEach(async () => {
    spanMock = makeSpanMock();
    tracerMock = { startSpan: jest.fn().mockReturnValue(spanMock) };
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracerMock);
    jest.spyOn(trace, 'setSpan').mockReturnValue(require('@opentelemetry/api').ROOT_CONTEXT);

    prometheusService = {
      recordHttpRequest: jest.fn(),
    } as any;

    telemetryService = {
      extractContext: jest.fn().mockReturnValue({}),
      extractTraceContext: jest
        .fn()
        .mockReturnValue({ traceId: 'trace-id-abc', spanId: 'span-id-xyz', correlationId: 'corr-1' }),
      injectTraceContext: jest.fn(),
    } as any;

    loggerService = {
      logWithCorrelation: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringInterceptor,
        { provide: PrometheusService, useValue: prometheusService },
        { provide: OpenTelemetryService, useValue: telemetryService },
        { provide: StructuredLoggerService, useValue: loggerService },
      ],
    }).compile();

    interceptor = module.get<MonitoringInterceptor>(MonitoringInterceptor);
  });

  afterEach(() => jest.restoreAllMocks());

  it('is defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('successful request', () => {
    it('starts a SERVER span', (done) => {
      const ctx = buildMockContext();
      const handler = buildCallHandler(of({ ok: true }));

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          expect(tracerMock.startSpan).toHaveBeenCalledWith(
            expect.stringContaining('GET'),
            expect.objectContaining({ kind: SpanKind.SERVER }),
            expect.anything(),
          );
          done();
        },
        error: done,
      });
    });

    it('records Prometheus HTTP metrics', (done) => {
      const ctx = buildMockContext();
      const handler = buildCallHandler(of({ ok: true }));

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(prometheusService.recordHttpRequest).toHaveBeenCalledWith(
            'GET',
            '/test',
            200,
            expect.any(Number),
          );
          done();
        },
        error: done,
      });
    });

    it('ends the span after the handler completes', (done) => {
      const ctx = buildMockContext();
      const handler = buildCallHandler(of({ ok: true }));

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(spanMock.end).toHaveBeenCalled();
          done();
        },
        error: done,
      });
    });

    it('emits structured logs for request start and completion', (done) => {
      const ctx = buildMockContext();
      const handler = buildCallHandler(of({}));

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          // Should be called twice: request start + request completed
          expect(loggerService.logWithCorrelation).toHaveBeenCalledTimes(2);
          done();
        },
        error: done,
      });
    });

    it('sets x-correlation-id response header', (done) => {
      const setHeaderMock = jest.fn();
      const ctx = buildMockContext({ response: { statusCode: 200, setHeader: setHeaderMock } });
      const handler = buildCallHandler(of({}));

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(setHeaderMock).toHaveBeenCalledWith(
            'x-correlation-id',
            expect.any(String),
          );
          done();
        },
        error: done,
      });
    });
  });

  describe('failed request', () => {
    it('records error on span and rethrows', (done) => {
      const ctx = buildMockContext();
      const err = Object.assign(new Error('bad'), { status: 500 });
      const handler = buildCallHandler(throwError(() => err));

      interceptor.intercept(ctx, handler).subscribe({
        error: (e) => {
          expect(e.message).toBe('bad');
          expect(spanMock.recordException).toHaveBeenCalledWith(err);
          expect(spanMock.end).toHaveBeenCalled();
          done();
        },
      });
    });

    it('records Prometheus metrics even on error', (done) => {
      const ctx = buildMockContext();
      const err = Object.assign(new Error('fail'), { status: 503 });
      const handler = buildCallHandler(throwError(() => err));

      interceptor.intercept(ctx, handler).subscribe({
        error: () => {
          expect(prometheusService.recordHttpRequest).toHaveBeenCalledWith(
            'GET',
            '/test',
            503,
            expect.any(Number),
          );
          done();
        },
      });
    });
  });

  describe('non-HTTP context', () => {
    it('passes through WebSocket/GraphQL subscription contexts without tracing', (done) => {
      const ctx = {
        getType: jest.fn().mockReturnValue('ws'),
      } as unknown as ExecutionContext;
      const handler = buildCallHandler(of('ws-message'));

      interceptor.intercept(ctx, handler).subscribe({
        next: (val) => {
          expect(val).toBe('ws-message');
          expect(tracerMock.startSpan).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
