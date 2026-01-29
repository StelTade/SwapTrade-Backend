import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when user balance is insufficient for the operation
 */
export class InsufficientBalanceException extends BaseException {
  constructor(
    asset: string,
    required: number,
    available: number,
    metadata?: Record<string, any>,
  ) {
    super(
      'INSUFFICIENT_BALANCE',
      `Insufficient balance for ${asset}. Required: ${required}, Available: ${available}`,
      HttpStatus.BAD_REQUEST,
      {
        asset,
        required,
        available,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, InsufficientBalanceException.prototype);
  }
}

/**
 * Exception thrown when a trade operation is invalid
 */
export class InvalidTradeException extends BaseException {
  constructor(reason: string, metadata?: Record<string, any>) {
    super(
      'INVALID_TRADE',
      `Invalid trade operation: ${reason}`,
      HttpStatus.BAD_REQUEST,
      metadata,
    );

    Object.setPrototypeOf(this, InvalidTradeException.prototype);
  }
}

/**
 * Exception thrown when a resource is not found
 */
export class ResourceNotFoundException extends BaseException {
  constructor(
    resourceType: string,
    identifier: string | number,
    metadata?: Record<string, any>,
  ) {
    super(
      'RESOURCE_NOT_FOUND',
      `${resourceType} with identifier ${identifier} not found`,
      HttpStatus.NOT_FOUND,
      {
        resourceType,
        identifier,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, ResourceNotFoundException.prototype);
  }
}

/**
 * Exception thrown when user is unauthorized to perform an operation
 */
export class UnauthorizedAccessException extends BaseException {
  constructor(action: string, metadata?: Record<string, any>) {
    super(
      'UNAUTHORIZED_ACCESS',
      `Unauthorized access to ${action}`,
      HttpStatus.FORBIDDEN,
      metadata,
    );

    Object.setPrototypeOf(this, UnauthorizedAccessException.prototype);
  }
}

/**
 * Exception thrown when user authentication fails
 */
export class AuthenticationFailedException extends BaseException {
  constructor(reason: string = 'Authentication failed', metadata?: Record<string, any>) {
    super(
      'AUTHENTICATION_FAILED',
      reason,
      HttpStatus.UNAUTHORIZED,
      metadata,
    );

    Object.setPrototypeOf(this, AuthenticationFailedException.prototype);
  }
}

/**
 * Exception thrown when rate limit is exceeded
 */
export class RateLimitExceededException extends BaseException {
  constructor(retryAfter?: number, metadata?: Record<string, any>) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Please try again later.${retryAfter ? ` Retry after ${retryAfter}s` : ''}`,
      HttpStatus.TOO_MANY_REQUESTS,
      {
        retryAfter,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, RateLimitExceededException.prototype);
  }
}

/**
 * Exception thrown when input validation fails
 */
export class ValidationException extends BaseException {
  constructor(errors: any, metadata?: Record<string, any>) {
    super(
      'VALIDATION_FAILED',
      'Request validation failed',
      HttpStatus.BAD_REQUEST,
      {
        validationErrors: errors,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, ValidationException.prototype);
  }
}

/**
 * Exception thrown when a conflict occurs (e.g., duplicate resource)
 */
export class ConflictException extends BaseException {
  constructor(message: string, metadata?: Record<string, any>) {
    super(
      'CONFLICT',
      message,
      HttpStatus.CONFLICT,
      metadata,
    );

    Object.setPrototypeOf(this, ConflictException.prototype);
  }
}

/**
 * Exception thrown for database operation errors
 */
export class DatabaseException extends BaseException {
  constructor(operation: string, reason: string, metadata?: Record<string, any>) {
    super(
      'DATABASE_ERROR',
      `Database error during ${operation}: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      {
        operation,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, DatabaseException.prototype);
  }
}

/**
 * Exception thrown for external service errors
 */
export class ExternalServiceException extends BaseException {
  constructor(service: string, reason: string, metadata?: Record<string, any>) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      `Error from ${service}: ${reason}`,
      HttpStatus.BAD_GATEWAY,
      {
        service,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, ExternalServiceException.prototype);
  }
}

/**
 * Exception thrown for operation timeout
 */
export class TimeoutException extends BaseException {
  constructor(operation: string, metadata?: Record<string, any>) {
    super(
      'OPERATION_TIMEOUT',
      `Operation '${operation}' timed out`,
      HttpStatus.REQUEST_TIMEOUT,
      {
        operation,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, TimeoutException.prototype);
  }
}

/**
 * Exception thrown when user performs restricted operation
 */
export class RestrictedOperationException extends BaseException {
  constructor(operation: string, reason: string, metadata?: Record<string, any>) {
    super(
      'RESTRICTED_OPERATION',
      `Operation '${operation}' is restricted: ${reason}`,
      HttpStatus.BAD_REQUEST,
      {
        operation,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, RestrictedOperationException.prototype);
  }
}

/**
 * Exception thrown when state transition is invalid
 */
export class InvalidStateException extends BaseException {
  constructor(
    currentState: string,
    targetState: string,
    metadata?: Record<string, any>,
  ) {
    super(
      'INVALID_STATE_TRANSITION',
      `Cannot transition from ${currentState} to ${targetState}`,
      HttpStatus.BAD_REQUEST,
      {
        currentState,
        targetState,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, InvalidStateException.prototype);
  }
}

/**
 * Exception thrown when a resource is locked or unavailable
 */
export class ResourceLockedException extends BaseException {
  constructor(
    resourceType: string,
    identifier: string | number,
    metadata?: Record<string, any>,
  ) {
    super(
      'RESOURCE_LOCKED',
      `${resourceType} with identifier ${identifier} is currently locked`,
      HttpStatus.LOCKED,
      {
        resourceType,
        identifier,
        ...metadata,
      },
    );

    Object.setPrototypeOf(this, ResourceLockedException.prototype);
  }
}
