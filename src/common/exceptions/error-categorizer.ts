import { HttpStatus } from '@nestjs/common';

/**
 * Error categories for classification and retry decisions
 */
export enum ErrorCategory {
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Error type classification
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INVALID_INPUT = 'INVALID_INPUT',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  INTERNAL = 'INTERNAL',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Enhanced error information
 */
export interface ErrorInfo {
  category: ErrorCategory;
  severity: ErrorSeverity;
  errorType: ErrorType;
  code: string;
  message: string;
  retryable: boolean;
  maxRetries?: number;
  backoffMultiplier?: number;
  circuitBreakerCompatible: boolean;
}

/**
 * Service for categorizing and classifying errors
 * Determines retry strategies and circuit breaker behavior
 */
export class ErrorCategorizer {
  private static readonly ERROR_CLASSIFICATION: Map<string, ErrorInfo> = new Map([
    // Transient Errors (retryable)
    ['ECONNREFUSED', {
      category: ErrorCategory.TRANSIENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.NETWORK,
      code: 'ECONNREFUSED',
      message: 'Connection refused',
      retryable: true,
      maxRetries: 5,
      backoffMultiplier: 2,
      circuitBreakerCompatible: true,
    }],
    ['ECONNRESET', {
      category: ErrorCategory.TRANSIENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.NETWORK,
      code: 'ECONNRESET',
      message: 'Connection reset',
      retryable: true,
      maxRetries: 5,
      backoffMultiplier: 2,
      circuitBreakerCompatible: true,
    }],
    ['ETIMEDOUT', {
      category: ErrorCategory.TRANSIENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.TIMEOUT,
      code: 'ETIMEDOUT',
      message: 'Connection timed out',
      retryable: true,
      maxRetries: 3,
      backoffMultiplier: 2,
      circuitBreakerCompatible: true,
    }],
    ['EHOSTUNREACH', {
      category: ErrorCategory.TRANSIENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.NETWORK,
      code: 'EHOSTUNREACH',
      message: 'Host unreachable',
      retryable: true,
      maxRetries: 3,
      backoffMultiplier: 2,
      circuitBreakerCompatible: true,
    }],
    // HTTP Status Codes
    ['429', {
      category: ErrorCategory.TRANSIENT,
      severity: ErrorSeverity.LOW,
      errorType: ErrorType.RATE_LIMIT,
      code: '429',
      message: 'Too many requests',
      retryable: true,
      maxRetries: 3,
      backoffMultiplier: 3,
      circuitBreakerCompatible: false,
    }],
    ['503', {
      category: ErrorCategory.TRANSIENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.SERVICE_UNAVAILABLE,
      code: '503',
      message: 'Service unavailable',
      retryable: true,
      maxRetries: 5,
      backoffMultiplier: 2,
      circuitBreakerCompatible: true,
    }],
    ['502', {
      category: ErrorCategory.TRANSIENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.SERVICE_UNAVAILABLE,
      code: '502',
      message: 'Bad gateway',
      retryable: true,
      maxRetries: 3,
      backoffMultiplier: 2,
      circuitBreakerCompatible: true,
    }],
    ['504', {
      category: ErrorCategory.TRANSIENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.TIMEOUT,
      code: '504',
      message: 'Gateway timeout',
      retryable: true,
      maxRetries: 3,
      backoffMultiplier: 2,
      circuitBreakerCompatible: true,
    }],
    // Permanent Errors (not retryable)
    ['400', {
      category: ErrorCategory.PERMANENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.INVALID_INPUT,
      code: '400',
      message: 'Bad request',
      retryable: false,
      circuitBreakerCompatible: false,
    }],
    ['401', {
      category: ErrorCategory.PERMANENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.AUTHENTICATION,
      code: '401',
      message: 'Unauthorized',
      retryable: false,
      circuitBreakerCompatible: false,
    }],
    ['403', {
      category: ErrorCategory.PERMANENT,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.AUTHORIZATION,
      code: '403',
      message: 'Forbidden',
      retryable: false,
      circuitBreakerCompatible: false,
    }],
    ['404', {
      category: ErrorCategory.PERMANENT,
      severity: ErrorSeverity.LOW,
      errorType: ErrorType.NOT_FOUND,
      code: '404',
      message: 'Not found',
      retryable: false,
      circuitBreakerCompatible: false,
    }],
  ]);

  /**
   * Categorize an error
   */
  static categorize(error: any): ErrorInfo {
    if (!error) {
      return this.getDefaultErrorInfo(ErrorCategory.UNKNOWN);
    }

    // Check for known error codes
    const errorCode = error.code || error.response?.status || error.message;
    const classified = this.ERROR_CLASSIFICATION.get(String(errorCode));

    if (classified) {
      return classified;
    }

    // Check for HTTP status codes
    if (error.status) {
      const statusClassified = this.ERROR_CLASSIFICATION.get(String(error.status));
      if (statusClassified) {
        return statusClassified;
      }
    }

    // Check for error message patterns
    if (error.message) {
      return this.categorizeByMessage(error.message);
    }

    // Default categorization
    return this.getDefaultErrorInfo(ErrorCategory.UNKNOWN);
  }

  /**
   * Categorize error by message patterns
   */
  private static categorizeByMessage(message: string): ErrorInfo {
    const msg = message.toLowerCase();

    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        category: ErrorCategory.TRANSIENT,
        severity: ErrorSeverity.MEDIUM,
        errorType: ErrorType.TIMEOUT,
        code: 'TIMEOUT',
        message: 'Operation timed out',
        retryable: true,
        maxRetries: 3,
        backoffMultiplier: 2,
        circuitBreakerCompatible: true,
      };
    }

    if (msg.includes('connection refused') || msg.includes('econnrefused')) {
      return {
        category: ErrorCategory.TRANSIENT,
        severity: ErrorSeverity.MEDIUM,
        errorType: ErrorType.NETWORK,
        code: 'CONNECTION_REFUSED',
        message: 'Connection refused',
        retryable: true,
        maxRetries: 5,
        backoffMultiplier: 2,
        circuitBreakerCompatible: true,
      };
    }

    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return {
        category: ErrorCategory.TRANSIENT,
        severity: ErrorSeverity.LOW,
        errorType: ErrorType.RATE_LIMIT,
        code: 'RATE_LIMITED',
        message: 'Rate limited, slow down',
        retryable: true,
        maxRetries: 3,
        backoffMultiplier: 3,
        circuitBreakerCompatible: false,
      };
    }

    if (msg.includes('validation failed') || msg.includes('invalid')) {
      return {
        category: ErrorCategory.PERMANENT,
        severity: ErrorSeverity.MEDIUM,
        errorType: ErrorType.INVALID_INPUT,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        retryable: false,
        circuitBreakerCompatible: false,
      };
    }

    if (msg.includes('not found') || msg.includes('does not exist')) {
      return {
        category: ErrorCategory.PERMANENT,
        severity: ErrorSeverity.LOW,
        errorType: ErrorType.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'Resource not found',
        retryable: false,
        circuitBreakerCompatible: false,
      };
    }

    if (msg.includes('database') || msg.includes('query failed')) {
      return {
        category: ErrorCategory.TRANSIENT,
        severity: ErrorSeverity.HIGH,
        errorType: ErrorType.DATABASE,
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        retryable: true,
        maxRetries: 3,
        backoffMultiplier: 2,
        circuitBreakerCompatible: true,
      };
    }

    return this.getDefaultErrorInfo(ErrorCategory.UNKNOWN);
  }

  /**
   * Get default error info
   */
  private static getDefaultErrorInfo(category: ErrorCategory): ErrorInfo {
    return {
      category,
      severity: ErrorSeverity.MEDIUM,
      errorType: ErrorType.UNKNOWN,
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      retryable: category === ErrorCategory.TRANSIENT,
      maxRetries: category === ErrorCategory.TRANSIENT ? 3 : 0,
      backoffMultiplier: 2,
      circuitBreakerCompatible: category === ErrorCategory.TRANSIENT,
    };
  }

  /**
   * Get HTTP status code for error category
   */
  static getHttpStatus(errorInfo: ErrorInfo): HttpStatus {
    switch (errorInfo.errorType) {
      case ErrorType.AUTHENTICATION:
        return HttpStatus.UNAUTHORIZED;
      case ErrorType.AUTHORIZATION:
        return HttpStatus.FORBIDDEN;
      case ErrorType.NOT_FOUND:
        return HttpStatus.NOT_FOUND;
      case ErrorType.INVALID_INPUT:
        return HttpStatus.BAD_REQUEST;
      case ErrorType.RATE_LIMIT:
        return HttpStatus.TOO_MANY_REQUESTS;
      case ErrorType.SERVICE_UNAVAILABLE:
        return HttpStatus.SERVICE_UNAVAILABLE;
      case ErrorType.TIMEOUT:
        return HttpStatus.GATEWAY_TIMEOUT;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: any): boolean {
    const errorInfo = this.categorize(error);
    return errorInfo.retryable;
  }

  /**
   * Check if error is compatible with circuit breaker
   */
  static isCircuitBreakerCompatible(error: any): boolean {
    const errorInfo = this.categorize(error);
    return errorInfo.circuitBreakerCompatible;
  }

  /**
   * Get max retries for error
   */
  static getMaxRetries(error: any): number {
    const errorInfo = this.categorize(error);
    return errorInfo.maxRetries || 0;
  }

  /**
   * Get backoff multiplier for error
   */
  static getBackoffMultiplier(error: any): number {
    const errorInfo = this.categorize(error);
    return errorInfo.backoffMultiplier || 2;
  }
}
