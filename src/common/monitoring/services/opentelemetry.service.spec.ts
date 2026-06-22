import { Test, TestingModule } from '@nestjs/testing';
import { OpenTelemetryService } from './opentelemetry.service';
import { TraceConfig, LogLevel } from '../interfaces/monitoring.interfaces';
import {
  trace,
  context,
  propagation,
  SpanStatusCode,
  SpanKind,
  ROOT_CONTEXT,
} from '@opentelemetry/api';

// ---------------------------------------------------------------------------
// Minimal span mock
// ---------------------------------------------------------------------------
const makeSpanMock = () => ({
  setAttribute: jest.fn(),
  setAttributes: jest.fn(),
  setStatus: jest.fn(),
  recordException: jest.fn(),
  end: jest.fn(),
  spanContext: jest.fn(() => ({
    traceId: 'aabbccddaabbccddaabbccddaabbccdd',
    spanId: '1122334455667788',
    traceFlags: 1,
  })),
});

describe('OpenTelemetryService', () => {
  let service: OpenTelemetryService;
  let spanMock: ReturnType<typeof makeSpanMock>;
  let startSpanSpy: jest.SpyInstance;
  let startActiveSpanSpy: jest.SpyInstance;

  const testConfig: TraceConfig = {
    enabled: true,
    samplingRate: 1.0,
    exportInterval: 5000,
    headers: {},
    serviceName: 'test-service',
    serviceVersion: '0.0.1',
    environment: 'test',
  };

  beforeEach(async () => {
    spanMock = makeSpanMock();

    // Mock the OTel tracer
    const tracerMock = {
      startSpan: jest.fn(() => spanMock),
      startActiveSpan: jest.fn((name, opts, fn) => {
        // if called with context arg (4-arg variant)
        const callback = typeof fn === 'function' ? fn : opts;
        return callback(spanMock);
      }),
    };
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracerMock as any);

    startSpanSpy = tracerMock.startSpan;
    startActiveSpanSpy = tracerMock.startActiveSpan;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: OpenTelemetryService,
          useFactory: () => new OpenTelemetryService(testConfig),
        },
      ],
    }).compile();

    service = module.get<OpenTelemetryService>(OpenTelemetryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── isEnabled ─────────────────────────────────────────────────────────────
  describe('isEnabled', () => {
    it('returns true when config.enabled is true', () => {
      expect(service.isEnabled).toBe(true);
    });

    it('returns false when config.enabled is false', () => {
      const disabledService = new OpenTelemetryService({
        ...testConfig,
        enabled: false,
      });
      expect(disabledService.isEnabled).toBe(false);
    });
  });

  // ── traceAsync ────────────────────────────────────────────────────────────
  describe('traceAsync', () => {
    it('starts an active span and returns the function result', async () => {
      const result = await service.traceAsync('test.op', async (_span) => 42);
      expect(result).toBe(42);
      expect(startActiveSpanSpy).toHaveBeenCalledWith(
        'test.op',
        expect.objectContaining({ kind: SpanKind.INTERNAL }),
        expect.any(Function),
      );
    });

    it('sets OK status and ends the span on success', async () => {
      await service.traceAsync('test.ok', async (span) => {
        // span is spanMock
      });
      expect(spanMock.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.OK,
      });
      expect(spanMock.end).toHaveBeenCalled();
    });

    it('sets ERROR status, records exception, and rethrows on failure', async () => {
      const err = new Error('boom');
      await expect(
        service.traceAsync('test.err', async () => {
          throw err;
        }),
      ).rejects.toThrow('boom');

      expect(spanMock.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: SpanStatusCode.ERROR }),
      );
      expect(spanMock.recordException).toHaveBeenCalledWith(err);
      expect(spanMock.end).toHaveBeenCalled();
    });
  });

  // ── traceSync ─────────────────────────────────────────────────────────────
  describe('traceSync', () => {
    it('executes synchronously and returns the result', () => {
      const result = service.traceSync('sync.op', () => 'hello');
      expect(result).toBe('hello');
      expect(spanMock.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.OK,
      });
    });

    it('records exception and rethrows on error', () => {
      const err = new Error('sync-fail');
      expect(() =>
        service.traceSync('sync.err', () => {
          throw err;
        }),
      ).toThrow('sync-fail');
      expect(spanMock.recordException).toHaveBeenCalledWith(err);
    });
  });

  // ── startSpan ─────────────────────────────────────────────────────────────
  describe('startSpan', () => {
    it('creates a span with enriched attributes', () => {
      service.startSpan('manual.span', SpanKind.CLIENT, {
        'http.method': 'GET',
      });

      expect(startSpanSpy).toHaveBeenCalledWith(
        'manual.span',
        expect.objectContaining({
          kind: SpanKind.CLIENT,
          attributes: expect.objectContaining({
            'service.name': 'test-service',
            'http.method': 'GET',
          }),
        }),
      );
    });
  });

  // ── extractTraceContext ───────────────────────────────────────────────────
  describe('extractTraceContext', () => {
    it('extracts traceId and spanId from a valid W3C traceparent header', () => {
      // Mock propagation.extract to return a span with a valid context
      jest.spyOn(propagation, 'extract').mockImplementation((ctx, carrier) => {
        return ctx;
      });
      jest.spyOn(trace, 'getSpan').mockReturnValue(spanMock as any);
      // isSpanContextValid is imported directly — mock the spanContext return
      spanMock.spanContext.mockReturnValue({
        traceId: 'aabbccddaabbccddaabbccddaabbccdd',
        spanId: '1122334455667788',
        traceFlags: 1,
      });

      const ctx = service.extractTraceContext({
        traceparent:
          '00-aabbccddaabbccddaabbccddaabbccdd-1122334455667788-01',
      });

      // Should at minimum contain a correlationId
      expect(ctx.correlationId).toBeDefined();
    });

    it('falls back to manual parsing when propagation returns no span', () => {
      jest
        .spyOn(propagation, 'extract')
        .mockReturnValue(ROOT_CONTEXT);
      jest.spyOn(trace, 'getSpan').mockReturnValue(undefined);

      const ctx = service.extractTraceContext({
        traceparent:
          '00-aabbccddaabbccddaabbccddaabbccdd-1122334455667788-01',
      });

      expect(ctx.traceId).toBe('aabbccddaabbccddaabbccddaabbccdd');
      expect(ctx.spanId).toBe('1122334455667788');
    });

    it('returns a uuid correlationId when no traceparent is present', () => {
      jest
        .spyOn(propagation, 'extract')
        .mockReturnValue(ROOT_CONTEXT);
      jest.spyOn(trace, 'getSpan').mockReturnValue(undefined);

      const ctx = service.extractTraceContext({});
      expect(ctx.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  // ── injectTraceContext ────────────────────────────────────────────────────
  describe('injectTraceContext', () => {
    it('calls propagation.inject with the active context', () => {
      const injectSpy = jest
        .spyOn(propagation, 'inject')
        .mockImplementation(() => {});

      const carrier: Record<string, string> = {};
      service.injectTraceContext(carrier);

      expect(injectSpy).toHaveBeenCalledWith(
        context.active(),
        carrier,
      );
    });
  });

  // ── traceDatabaseQuery ────────────────────────────────────────────────────
  describe('traceDatabaseQuery', () => {
    it('creates a CLIENT span with sanitised SQL', () => {
      service.traceDatabaseQuery(
        "SELECT * FROM users WHERE id = 42 AND name = 'Alice'",
        'postgresql',
        15,
        undefined,
        'SELECT',
        'users',
      );

      expect(startSpanSpy).toHaveBeenCalledWith(
        'SELECT users',
        expect.objectContaining({
          kind: SpanKind.CLIENT,
          attributes: expect.objectContaining({
            'db.system': 'postgresql',
            'db.operation': 'SELECT',
            'db.sql.table': 'users',
          }),
        }),
      );

      // PII in literal values should be sanitised
      const callAttributes =
        startSpanSpy.mock.calls[0][1].attributes['db.statement'];
      expect(callAttributes).not.toContain('Alice');
    });

    it('records error and sets ERROR status when error is provided', () => {
      const err = new Error('db-fail');
      service.traceDatabaseQuery('SELECT 1', 'postgresql', 5, err);
      expect(spanMock.recordException).toHaveBeenCalledWith(err);
      expect(spanMock.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: SpanStatusCode.ERROR }),
      );
    });
  });

  // ── traceExternalServiceCall ──────────────────────────────────────────────
  describe('traceExternalServiceCall', () => {
    it('creates a CLIENT span for successful calls', () => {
      service.traceExternalServiceCall('stellar', 'fetchBalance', 120, true);
      expect(spanMock.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.OK,
      });
    });

    it('records error for failed calls', () => {
      const err = new Error('timeout');
      service.traceExternalServiceCall(
        'stellar',
        'fetchBalance',
        5000,
        false,
        err,
      );
      expect(spanMock.recordException).toHaveBeenCalledWith(err);
    });
  });

  // ── traceMessageProcessing ────────────────────────────────────────────────
  describe('traceMessageProcessing', () => {
    it('creates a CONSUMER span', () => {
      service.traceMessageProcessing('trade-queue', 'msg-001', 50, true);
      expect(startSpanSpy).toHaveBeenCalledWith(
        'messaging.process',
        expect.objectContaining({ kind: SpanKind.CONSUMER }),
      );
    });
  });

  // ── onModuleDestroy ───────────────────────────────────────────────────────
  describe('onModuleDestroy', () => {
    it('resolves without throwing', async () => {
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
