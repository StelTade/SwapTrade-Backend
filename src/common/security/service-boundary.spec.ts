import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InternalServiceGuard } from '../guards/internal-service.guard';

function buildContext(ip: string, internalHeader?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        headers: internalHeader ? { 'x-internal-request': internalHeader } : {},
        method: 'GET',
        path: '/internal/metrics',
        socket: { remoteAddress: ip },
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('InternalServiceGuard', () => {
  let guard: InternalServiceGuard;

  beforeEach(() => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    guard = new InternalServiceGuard(reflector);
  });

  afterEach(() => {
    delete process.env.INTERNAL_API_SECRET;
  });

  it('should allow loopback (127.0.0.1) access', () => {
    expect(guard.canActivate(buildContext('127.0.0.1'))).toBe(true);
  });

  it('should allow loopback (::1) access', () => {
    expect(guard.canActivate(buildContext('::1'))).toBe(true);
  });

  it('should allow loopback (::ffff:127.0.0.1) access', () => {
    expect(guard.canActivate(buildContext('::ffff:127.0.0.1'))).toBe(true);
  });

  it('should block public IP without internal secret header', () => {
    expect(() => guard.canActivate(buildContext('203.0.113.5'))).toThrow(ForbiddenException);
  });

  it('should allow public IP with valid internal secret header', () => {
    process.env.INTERNAL_API_SECRET = 'super-secret';
    expect(guard.canActivate(buildContext('203.0.113.5', 'super-secret'))).toBe(true);
  });

  it('should block public IP with wrong internal secret header', () => {
    process.env.INTERNAL_API_SECRET = 'super-secret';
    expect(() => guard.canActivate(buildContext('203.0.113.5', 'wrong-secret'))).toThrow(
      ForbiddenException,
    );
  });

  it('should pass through non-internal endpoints without checks', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const publicGuard = new InternalServiceGuard(reflector);
    expect(publicGuard.canActivate(buildContext('203.0.113.5'))).toBe(true);
  });
});
