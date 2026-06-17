import { HttpStatus } from '@nestjs/common';
import { StructuredException } from '../errors/structured.exception';
import { ERROR_CODES } from '../constants/error-codes';

export class AuthenticationException extends StructuredException {
  constructor(
    code: keyof typeof ERROR_CODES = 'AUTH_INVALID_CREDENTIALS_401',
    details?: Record<string, any>,
    requestId?: string,
  ) {
    const errorDef = ERROR_CODES[code];
    super(
      errorDef.code,
      errorDef.message,
      errorDef.httpStatus,
      details,
      requestId,
      errorDef.retryable,
    );
  }

  static tokenExpired(
    details?: Record<string, any>,
    requestId?: string,
  ): AuthenticationException {
    return new AuthenticationException(
      'AUTH_TOKEN_EXPIRED_401',
      details,
      requestId,
    );
  }

  static invalidCredentials(
    details?: Record<string, any>,
    requestId?: string,
  ): AuthenticationException {
    return new AuthenticationException(
      'AUTH_INVALID_CREDENTIALS_401',
      details,
      requestId,
    );
  }

  static insufficientPermissions(
    details?: Record<string, any>,
    requestId?: string,
  ): AuthenticationException {
    return new AuthenticationException(
      'AUTH_INSUFFICIENT_PERMISSIONS_403',
      details,
      requestId,
    );
  }

  static tokenMissing(
    details?: Record<string, any>,
    requestId?: string,
  ): AuthenticationException {
    return new AuthenticationException(
      'AUTH_TOKEN_MISSING_401',
      details,
      requestId,
    );
  }

  static tokenInvalid(
    details?: Record<string, any>,
    requestId?: string,
  ): AuthenticationException {
    return new AuthenticationException(
      'AUTH_TOKEN_INVALID_401',
      details,
      requestId,
    );
  }
}
