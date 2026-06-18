import { HttpStatus } from '@nestjs/common';

/**
 * StructuredException - Base class for all application exceptions
 * Provides consistent error structure with error codes, HTTP status, and metadata
 */
export class StructuredException extends Error {
  public readonly code: string;
  public readonly httpStatus: HttpStatus;
  public readonly message: string;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly requestId?: string;
  public readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    httpStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    details?: Record<string, any>,
    requestId?: string,
    retryable: boolean = false,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.message = message;
    this.details = details;
    this.timestamp = new Date();
    this.requestId = requestId;
    this.retryable = retryable;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to response format for API
   */
  toResponse(): Record<string, any> {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId: this.requestId,
        timestamp: this.timestamp.toISOString(),
        retryable: this.retryable,
      },
    };
  }
}
