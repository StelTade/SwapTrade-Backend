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
import { I18nService } from 'nestjs-i18n';
import { StructuredException } from '../errors/structured.exception';
import { ErrorCodeRegistry } from '../error-code.registry';
import { ERROR_CODES } from '../constants/error-codes';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(@Optional() private readonly i18n?: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const lang = request.headers['accept-language']?.split(',')[0] || 'en';

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any;
    let errorCode = 'INTERNAL_SERVER_ERROR_500';

    // Handle StructuredException (prioritize)
    if (exception instanceof StructuredException) {
      status = exception.httpStatus;
      errorResponse = this.normalizeStructuredExceptionResponse(
        exception,
        request,
      );
      errorCode = exception.code;
    }
    // Handle standard HttpException
    else if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      status = httpStatus;
      errorResponse = this.normalizeHttpExceptionResponse(
        exception,
        request,
        httpStatus,
      );
      errorCode = this.mapHttpStatusToErrorCode(httpStatus);
    }
    // Handle validation errors (from ValidationPipe)
    else if (this.isValidationError(exception)) {
      status = HttpStatus.BAD_REQUEST;
      errorResponse = this.normalizeValidationErrorResponse(exception, request);
      errorCode = 'VALIDATION_INVALID_INPUT_400';
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = this.normalizeGenericErrorResponse(
        exception,
        request,
        status,
      );
      errorCode = 'INTERNAL_SERVER_ERROR_500';
    }
    // Handle unknown exceptions
    else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR_500',
          message: 'An unknown error occurred',
          requestId: this.extractRequestId(request),
          timestamp: new Date().toISOString(),
          retryable: false,
          severity: 'SERVER',
          category: 'INTERNAL_ERROR',
        },
      };
    }

    // Ensure response has all required fields
    errorResponse = this.ensureResponseCompliance(
      errorResponse,
      errorCode,
      status,
    );

    // Translate message if I18nService is available
    if (this.i18n) {
      try {
        const translated = this.i18n.translate(`common.ERROR.${errorCode}`, {
          lang,
        });
        if (translated && !translated.startsWith('common.ERROR.')) {
          errorResponse.error.message = translated;
        }
      } catch (e) {
        // Fallback to default message
      }
    }

    // Log error appropriately
    this.logError(errorCode, exception, request);

    response.status(status).json(errorResponse);
  }

  /**
   * Normalize StructuredException response
   */
  private normalizeStructuredExceptionResponse(
    exception: StructuredException,
    request: Request,
  ): any {
    const errorDef = ErrorCodeRegistry.getErrorDefinition(exception.code);

    return {
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId: this.extractRequestId(request) || exception.requestId,
        timestamp: exception.timestamp.toISOString(),
        retryable: exception.retryable,
        severity: this.determineSeverity(exception.httpStatus),
        category: errorDef?.category || 'INTERNAL_ERROR',
      },
    };
  }

  /**
   * Normalize HttpException response
   */
  private normalizeHttpExceptionResponse(
    exception: HttpException,
    request: Request,
    status: number,
  ): any {
    const exceptionResponse = exception.getResponse();
    let code = this.mapHttpStatusToErrorCode(status);
    let message = exception.message || 'HTTP Exception';
    let details: any = undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const responseObj = exceptionResponse as any;
      code = responseObj.error?.code || code;
      message = responseObj.message || responseObj.error?.message || message;
      details = responseObj.details || responseObj.error;
    }

    const errorDef = ErrorCodeRegistry.getErrorDefinition(code);

    return {
      success: false,
      error: {
        code,
        message,
        details,
        requestId: this.extractRequestId(request),
        timestamp: new Date().toISOString(),
        retryable: this.isRetryable(status),
        severity: this.determineSeverity(status),
        category: errorDef?.category || 'SYSTEM',
      },
    };
  }

  /**
   * Normalize validation error response
   */
  private normalizeValidationErrorResponse(
    exception: any,
    request: Request,
  ): any {
    const validationErrors = exception.getResponse?.()?.message || [];
    const details = Array.isArray(validationErrors)
      ? validationErrors.map((err: any) => ({
          field: err.property || 'unknown',
          value: err.value,
          constraints: err.constraints,
          reason: Object.values(err.constraints || {}).join(', '),
        }))
      : { reason: 'Validation failed' };

    return {
      success: false,
      error: {
        code: 'VALIDATION_INVALID_INPUT_400',
        message: 'Input validation failed',
        details,
        requestId: this.extractRequestId(request),
        timestamp: new Date().toISOString(),
        retryable: false,
        severity: 'CLIENT',
        category: 'VALIDATION',
      },
    };
  }

  /**
   * Normalize generic error response
   */
  private normalizeGenericErrorResponse(
    exception: Error,
    request: Request,
    status: HttpStatus,
  ): any {
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR_500',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An internal server error occurred'
            : exception.message,
        details:
          process.env.NODE_ENV !== 'production'
            ? {
                errorType: exception.constructor.name,
                stack: exception.stack?.split('\n').slice(0, 5),
              }
            : undefined,
        requestId: this.extractRequestId(request),
        timestamp: new Date().toISOString(),
        retryable: false,
        severity: this.determineSeverity(status),
        category: 'INTERNAL_ERROR',
      },
    };
  }

  /**
   * Ensure response complies with standard format
   */
  private ensureResponseCompliance(
    response: any,
    errorCode: string,
    status: number,
  ): any {
    if (!response.error) {
      response.error = {};
    }

    const errorDef = ErrorCodeRegistry.getErrorDefinition(errorCode);

    // Set default values if missing
    response.success = false;
    response.error.code = response.error.code || errorCode;
    response.error.message =
      response.error.message || errorDef?.message || 'An error occurred';
    response.error.timestamp =
      response.error.timestamp || new Date().toISOString();
    response.error.retryable =
      response.error.retryable !== undefined
        ? response.error.retryable
        : this.isRetryable(status);
    response.error.severity =
      response.error.severity || this.determineSeverity(status);
    response.error.category = response.error.category || 'SYSTEM';

    return response;
  }

  /**
   * Check if exception is a validation error
   */
  private isValidationError(exception: any): boolean {
    return (
      exception?.getStatus?.() === 400 &&
      exception?.getResponse?.()?.message &&
      Array.isArray(exception.getResponse().message)
    );
  }

  /**
   * Map HTTP status to error code
   */
  private mapHttpStatusToErrorCode(status: number): string {
    const statusMap: Record<number, string> = {
      400: 'VALIDATION_INVALID_INPUT_400',
      401: 'AUTH_INVALID_CREDENTIALS_401',
      403: 'AUTH_INSUFFICIENT_PERMISSIONS_403',
      404: 'DATABASE_RECORD_NOT_FOUND_404',
      429: 'RATE_LIMIT_EXCEEDED_429',
      500: 'INTERNAL_SERVER_ERROR_500',
      502: 'EXTERNAL_SERVICE_ERROR_502',
      503: 'DATABASE_CONNECTION_ERROR_503',
      504: 'DATABASE_QUERY_TIMEOUT_504',
    };

    return statusMap[status] || 'INTERNAL_SERVER_ERROR_500';
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(status: number): boolean {
    // Transient errors that can be retried
    return [408, 429, 500, 502, 503, 504].includes(status);
  }

  /**
   * Determine error severity
   */
  private determineSeverity(status: number): string {
    if (status >= 500) {
      return 'SERVER';
    }
    if (status === 429) {
      return 'TRANSIENT';
    }
    if (status >= 400) {
      return 'CLIENT';
    }
    return 'WARNING';
  }

  /**
   * Extract request ID from request
   */
  private extractRequestId(request: Request): string | undefined {
    return (
      (request as any).requestId ||
      (request.headers as any)['x-request-id'] ||
      (request.headers as any)['x-correlation-id']
    );
  }

  /**
   * Log error appropriately based on environment and severity
   */
  private logError(code: string, exception: any, request: Request): void {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[${code}] Exception caught by AppExceptionFilter:`,
        exception,
      );
    } else {
      // Log critical errors even in production
      if (
        code.includes('500') ||
        code.includes('CRITICAL') ||
        code.includes('BLOCKCHAIN_TRANSACTION_FAILED')
      ) {
        console.error(
          `[${code}] Production error on ${request.method} ${request.url}:`,
          {
            message: exception?.message,
            code,
          },
        );
      }
    }
  }
}
