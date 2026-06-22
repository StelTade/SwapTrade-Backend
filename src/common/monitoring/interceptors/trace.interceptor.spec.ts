import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TraceInterceptor } from './trace.interceptor';
import { TRACE_METADATA_KEY, TraceOptions } from '../decorators/trace.decorator';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeSpanMock = () => ({
  setStatus: jest.fn(),
  recordException: jest.fn(),
  end: jest.fn(),
});

function buildContext(options?: TraceOptions | null): ExecutionContext {
  const handler = jest.fn();
  const cls = class TestController {};

  return {
    getHandler: jest.fn().mockReturnValue(handler),
    getClass: jest.fn().mockReturnValue(cls),
  } as unknown as ExecutionContext;
}

function buildCallHandler(obs: any): CallHandler {
  return { handle: jest.fn().mockReturnValue(obs) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TraceInterceptor', () => {
  let interceptor: TraceInterceptor;
  let reflector: Reflector;
  let spanMock: ReturnType<typeof makeSpanMock>;
  let startActiveSpanSpy: jest.Mock;

  beforeEach(async () => {
    spanMock = makeSpanMock();

    startActiveSpanSpy = jest.fn((name, opts, fn) => fn(spanMock));
    const tracerMock = { startActiveSpan: startActiveSpanSpy };
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracerMock as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [TraceInterceptor, Reflector],
    }).compile();

    interceptor = module.get<TraceInterceptor>(TraceInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => jest.restoreAllMocks());

  it('is defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('when @Trace decorator is present', () => {
    it('starts an active span with the custom name', (done) => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({ name: 'custom.operation' } as TraceOptions);

      const ctx = buildContext();
      const handler = buildCallHandler(of('result'));

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          expect(startActiveSpanSpy).toHaveBeenCalledWith(
            'custom.operation',
            expect.objectContaining({ kind: SpanKind.INTERNAL }),
            expect.any(Function),
          );
          done();
        },
        error: done,
      });
    });

    it('uses className.handlerName when no name is provided', (done) => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({} as TraceOptions);

      const ctx = buildContext();
      const handler = buildCallHandler(of('ok'));

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          const spanName: string = startActiveSpanSpy.mock.calls[0][0];
          expect(spanName).toContain('.');
          done();
        },
        error: done,
      });
    });

    it('sets OK status on successful completion', (done) => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({ name: 'op' } as TraceOptions);

      const ctx = buildContext();
      const handler = buildCallHandler(of('ok'));

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(spanMock.setStatus).toHaveBeenCalledWith({
            code: SpanStatusCode.OK,
          });
          expect(spanMock.end).toHaveBeenCalled();
          done();
        },
        error: done,
      });
    });

    it('records exception and sets ERROR status on handler error', (done) => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({ name: 'op' } as TraceOptions);

      const err = new Error('handler-fail');
      const ctx = buildContext();
      const handler = buildCallHandler(throwError(() => err));

      interceptor.intercept(ctx, handler).subscribe({
        error: (e) => {
          expect(e.message).toBe('handler-fail');
          expect(spanMock.recordException).toHaveBeenCalledWith(err);
          expect(spanMock.setStatus).toHaveBeenCalledWith(
            expect.objectContaining({ code: SpanStatusCode.ERROR }),
          );
          expect(spanMock.end).toHaveBeenCalled();
          done();
        },
      });
    });

    it('respects the kind option', (done) => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        name: 'client.call',
        kind: 'CLIENT',
      } as TraceOptions);

      const ctx = buildContext();
      const handler = buildCallHandler(of('ok'));

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(startActiveSpanSpy).toHaveBeenCalledWith(
            'client.call',
            expect.objectContaining({ kind: SpanKind.CLIENT }),
            expect.any(Function),
          );
          done();
        },
        error: done,
      });
    });

    it('attaches custom attributes to the span', (done) => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        name: 'trade.create',
        attributes: { 'trade.type': 'limit' },
      } as TraceOptions);

      const ctx = buildContext();
      const handler = buildCallHandler(of('ok'));

      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(startActiveSpanSpy).toHaveBeenCalledWith(
            'trade.create',
            expect.objectContaining({
              attributes: expect.objectContaining({ 'trade.type': 'limit' }),
            }),
            expect.any(Function),
          );
          done();
        },
        error: done,
      });
    });
  });

  describe('when @Trace decorator is absent', () => {
    it('passes through without creating a span', (done) => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(undefined);

      const ctx = buildContext();
      const handler = buildCallHandler(of('passthrough'));

      interceptor.intercept(ctx, handler).subscribe({
        next: (val) => {
          expect(val).toBe('passthrough');
          expect(startActiveSpanSpy).not.toHaveBeenCalled();
          done();
        },
        error: done,
      });
    });
  });
});
