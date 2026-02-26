import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

/**
 * Swagger documentation decorator for standard error responses
 * Applies consistent error documentation across API endpoints
 */
export function ApiErrorResponses() {
  return applyDecorators(
    // 400 - Bad Request
    ApiResponse({
      status: 400,
      description: 'Bad Request - Validation error or invalid input',
      schema: {
        example: {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed',
            timestamp: '2024-01-29T10:30:00.000Z',
            validationErrors: {
              email: ['Email must be valid'],
              amount: ['Amount must be a positive number'],
            },
          },
        },
      },
    }),
    // 401 - Unauthorized
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Authentication failed or token invalid',
      schema: {
        example: {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed. Invalid credentials provided.',
            timestamp: '2024-01-29T10:30:00.000Z',
          },
        },
      },
    }),
    // 403 - Forbidden
    ApiResponse({
      status: 403,
      description: 'Forbidden - User lacks required permissions',
      schema: {
        example: {
          success: false,
          error: {
            code: 'UNAUTHORIZED_ACCESS',
            message: 'You do not have permission to access this resource.',
            timestamp: '2024-01-29T10:30:00.000Z',
          },
        },
      },
    }),
    // 404 - Not Found
    ApiResponse({
      status: 404,
      description: 'Not Found - Resource not found',
      schema: {
        example: {
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'User with identifier 123 not found',
            timestamp: '2024-01-29T10:30:00.000Z',
            metadata: {
              resourceType: 'User',
              identifier: 123,
            },
          },
        },
      },
    }),
    // 409 - Conflict
    ApiResponse({
      status: 409,
      description: 'Conflict - Resource already exists or state conflict',
      schema: {
        example: {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Operation conflicts with current state.',
            timestamp: '2024-01-29T10:30:00.000Z',
          },
        },
      },
    }),
    // 429 - Too Many Requests
    ApiResponse({
      status: 429,
      description: 'Too Many Requests - Rate limit exceeded',
      schema: {
        example: {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please try again later. Retry after 60s',
            timestamp: '2024-01-29T10:30:00.000Z',
            metadata: {
              retryAfter: 60,
            },
          },
        },
      },
    }),
    // 500 - Internal Server Error
    ApiResponse({
      status: 500,
      description: 'Internal Server Error - Unexpected server error',
      schema: {
        example: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: '2024-01-29T10:30:00.000Z',
          },
        },
      },
    }),
  );
}

/**
 * Swagger documentation decorator for balance-specific errors
 */
export function ApiBalanceErrorResponses() {
  return applyDecorators(
    ApiErrorResponses(),
    ApiResponse({
      status: 400,
      description: 'Insufficient Balance',
      schema: {
        example: {
          success: false,
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: 'Insufficient balance for BTC. Required: 0.5, Available: 0.2',
            timestamp: '2024-01-29T10:30:00.000Z',
            metadata: {
              asset: 'BTC',
              required: 0.5,
              available: 0.2,
            },
          },
        },
      },
    }),
  );
}

/**
 * Swagger documentation decorator for trade-specific errors
 */
export function ApiTradeErrorResponses() {
  return applyDecorators(
    ApiErrorResponses(),
    ApiResponse({
      status: 400,
      description: 'Invalid Trade Operation',
      schema: {
        example: {
          success: false,
          error: {
            code: 'INVALID_TRADE',
            message: 'Invalid trade operation: Cannot trade with self',
            timestamp: '2024-01-29T10:30:00.000Z',
          },
        },
      },
    }),
  );
}

/**
 * Swagger documentation decorator for authentication errors
 */
export function ApiAuthErrorResponses() {
  return applyDecorators(
    ApiResponse({
      status: 401,
      description: 'Authentication failed',
      schema: {
        example: {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Invalid credentials provided.',
            timestamp: '2024-01-29T10:30:00.000Z',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Validation error',
      schema: {
        example: {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed',
            timestamp: '2024-01-29T10:30:00.000Z',
            validationErrors: {
              email: ['Email must be valid'],
              password: ['Password must be at least 8 characters'],
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 429,
      description: 'Rate limit exceeded',
      schema: {
        example: {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please try again later.',
            timestamp: '2024-01-29T10:30:00.000Z',
            metadata: {
              retryAfter: 60,
            },
          },
        },
      },
    }),
  );
}
