import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { BaseException } from '../exceptions/base.exception';
import { ErrorLoggerService } from '../logging/error-logger.service';

/**
 * Global exception filter that catches all exceptions and returns consistent error responses
 * Handles both custom exceptions and standard HTTP exceptions
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Optional() @Inject('ErrorLoggerService')
    private readonly errorLogger?: ErrorLoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any;

    // Handle custom BaseException
    if (exception instanceof BaseException) {
      status = exception.statusCode;
      errorResponse = exception.getResponse();
    }
    // Handle standard NestJS HttpException
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Format validation errors from class-validator
      if (status === HttpStatus.BAD_REQUEST && this.isValidationError(exceptionResponse)) {
        errorResponse = this.formatValidationError(exceptionResponse);
      } else {
        errorResponse = {
          success: false,
          error: {
            code: 'HTTP_EXCEPTION',
            message: exception.message,
            timestamp: new Date().toISOString(),
          },
        };
      }
    }
    // Handle other error types
    else if (exception instanceof Error) {
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: exception.message || 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    } else {
      errorResponse = {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Log the error
    if (this.errorLogger) {
      this.errorLogger.logError(
        exception,
        request,
        status,
        exception instanceof BaseException ? exception.errorCode : undefined,
      );
    } else {
      // Fallback logging
      console.error({
        message: 'Unhandled exception',
        error: exception instanceof Error ? exception.message : exception,
        statusCode: status,
        method: request.method,
        url: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // Send response
    response.status(status).json(errorResponse);
  }

  /**
   * Check if exception response is a validation error from class-validator
   */
  private isValidationError(response: any): boolean {
    return (
      Array.isArray(response.message) &&
      response.message.some((msg) => typeof msg === 'string' && msg.includes('is'))
    );
  }

  /**
   * Format validation errors into a consistent structure
   */
  private formatValidationError(response: any): any {
    const errors = Array.isArray(response.message) ? response.message : [response.message];
    const formattedErrors = {};

    errors.forEach((error) => {
      if (typeof error === 'object') {
        const property = error.property || 'unknown';
        formattedErrors[property] = error.constraints
          ? Object.values(error.constraints)
          : [error.message];
      } else {
        formattedErrors['general'] = formattedErrors['general'] || [];
        formattedErrors['general'].push(error);
      }
    });

    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        timestamp: new Date().toISOString(),
        validationErrors: formattedErrors,
      },
    };
  }
}
