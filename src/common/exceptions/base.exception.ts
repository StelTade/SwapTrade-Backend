import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base custom exception class for all application-specific errors
 * Provides consistent error structure with error codes and metadata
 */
export class BaseException extends HttpException {
  public readonly errorCode: string;
  public readonly statusCode: HttpStatus;
  public readonly metadata?: Record<string, any>;

  constructor(
    errorCode: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    metadata?: Record<string, any>,
  ) {
    const response = {
      success: false,
      error: {
        code: errorCode,
        message,
        timestamp: new Date().toISOString(),
      },
      ...(metadata && { metadata }),
    };

    super(response, statusCode);

    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.metadata = metadata;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, BaseException.prototype);
  }
}
