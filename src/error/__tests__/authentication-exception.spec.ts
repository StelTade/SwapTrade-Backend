import { HttpStatus } from '@nestjs/common';
import { AuthenticationException } from '../exceptions/authentication.exception';

describe('AuthenticationException', () => {
  it('should create token expired exception', () => {
    const exception = AuthenticationException.tokenExpired(
      { token: 'abc' },
      'req-123',
    );

    expect(exception.code).toBe('AUTH_TOKEN_EXPIRED_401');
    expect(exception.httpStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(exception.retryable).toBe(false);
    expect(exception.details).toEqual({ token: 'abc' });
    expect(exception.requestId).toBe('req-123');
  });

  it('should create invalid credentials exception', () => {
    const exception = AuthenticationException.invalidCredentials();

    expect(exception.code).toBe('AUTH_INVALID_CREDENTIALS_401');
    expect(exception.httpStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(exception.retryable).toBe(false);
  });

  it('should create insufficient permissions exception', () => {
    const exception = AuthenticationException.insufficientPermissions();

    expect(exception.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS_403');
    expect(exception.httpStatus).toBe(HttpStatus.FORBIDDEN);
    expect(exception.retryable).toBe(false);
  });

  it('should create token missing exception', () => {
    const exception = AuthenticationException.tokenMissing();

    expect(exception.code).toBe('AUTH_TOKEN_MISSING_401');
    expect(exception.httpStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(exception.retryable).toBe(false);
  });

  it('should create token invalid exception', () => {
    const exception = AuthenticationException.tokenInvalid();

    expect(exception.code).toBe('AUTH_TOKEN_INVALID_401');
    expect(exception.httpStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(exception.retryable).toBe(false);
  });
});
