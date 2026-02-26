/**
 * Comprehensive error codes and messages for API responses
 * Used for consistent error handling across the application
 */

export const ERROR_CODES = {
  // Authentication & Authorization
  AUTHENTICATION_FAILED: {
    code: 'AUTH_001',
    message: 'Authentication failed. Invalid credentials provided.',
    httpStatus: 401,
  },
  INVALID_TOKEN: {
    code: 'AUTH_002',
    message: 'Invalid or expired token.',
    httpStatus: 401,
  },
  UNAUTHORIZED_ACCESS: {
    code: 'AUTH_003',
    message: 'You do not have permission to access this resource.',
    httpStatus: 403,
  },
  TOKEN_REQUIRED: {
    code: 'AUTH_004',
    message: 'Authorization token is required.',
    httpStatus: 401,
  },

  // Balance & Wallet
  INSUFFICIENT_BALANCE: {
    code: 'BAL_001',
    message: 'Insufficient balance for this operation.',
    httpStatus: 400,
  },
  INVALID_ASSET: {
    code: 'BAL_002',
    message: 'Invalid or unsupported asset.',
    httpStatus: 400,
  },
  BALANCE_NOT_FOUND: {
    code: 'BAL_003',
    message: 'Balance record not found.',
    httpStatus: 404,
  },

  // Trading & Orders
  INVALID_TRADE: {
    code: 'TRD_001',
    message: 'Invalid trade operation.',
    httpStatus: 400,
  },
  TRADE_NOT_FOUND: {
    code: 'TRD_002',
    message: 'Trade not found.',
    httpStatus: 404,
  },
  INVALID_ORDER: {
    code: 'TRD_003',
    message: 'Invalid order parameters.',
    httpStatus: 400,
  },
  ORDER_NOT_FOUND: {
    code: 'TRD_004',
    message: 'Order not found.',
    httpStatus: 404,
  },
  CANNOT_CANCEL_ORDER: {
    code: 'TRD_005',
    message: 'Cannot cancel this order. Invalid order state.',
    httpStatus: 400,
  },

  // User & Account
  USER_NOT_FOUND: {
    code: 'USR_001',
    message: 'User not found.',
    httpStatus: 404,
  },
  USER_ALREADY_EXISTS: {
    code: 'USR_002',
    message: 'User already exists.',
    httpStatus: 409,
  },
  INVALID_USER_DATA: {
    code: 'USR_003',
    message: 'Invalid user data provided.',
    httpStatus: 400,
  },

  // Validation
  VALIDATION_FAILED: {
    code: 'VAL_001',
    message: 'Request validation failed.',
    httpStatus: 400,
  },
  MISSING_REQUIRED_FIELD: {
    code: 'VAL_002',
    message: 'Required field is missing.',
    httpStatus: 400,
  },
  INVALID_FORMAT: {
    code: 'VAL_003',
    message: 'Invalid format provided.',
    httpStatus: 400,
  },

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: {
    code: 'RLM_001',
    message: 'Rate limit exceeded. Please try again later.',
    httpStatus: 429,
  },

  // Conflicts
  CONFLICT: {
    code: 'CNF_001',
    message: 'Operation conflicts with current state.',
    httpStatus: 409,
  },
  DUPLICATE_RESOURCE: {
    code: 'CNF_002',
    message: 'Resource already exists.',
    httpStatus: 409,
  },

  // Database
  DATABASE_ERROR: {
    code: 'DB_001',
    message: 'Database operation failed.',
    httpStatus: 500,
  },
  TRANSACTION_FAILED: {
    code: 'DB_002',
    message: 'Transaction failed. Please try again.',
    httpStatus: 500,
  },

  // External Services
  EXTERNAL_SERVICE_ERROR: {
    code: 'EXT_001',
    message: 'External service error.',
    httpStatus: 502,
  },
  PRICE_FEED_ERROR: {
    code: 'EXT_002',
    message: 'Unable to fetch price information.',
    httpStatus: 503,
  },

  // Business Logic
  INVALID_STATE_TRANSITION: {
    code: 'BIZ_001',
    message: 'Invalid state transition.',
    httpStatus: 400,
  },
  RESOURCE_LOCKED: {
    code: 'BIZ_002',
    message: 'Resource is currently locked.',
    httpStatus: 423,
  },
  OPERATION_NOT_PERMITTED: {
    code: 'BIZ_003',
    message: 'This operation is not permitted.',
    httpStatus: 400,
  },

  // Timeouts
  OPERATION_TIMEOUT: {
    code: 'TIM_001',
    message: 'Operation timed out. Please try again.',
    httpStatus: 408,
  },

  // General
  INTERNAL_ERROR: {
    code: 'GEN_001',
    message: 'An unexpected error occurred.',
    httpStatus: 500,
  },
  NOT_IMPLEMENTED: {
    code: 'GEN_002',
    message: 'This feature is not yet implemented.',
    httpStatus: 501,
  },
};

/**
 * Error category enum for classification
 */
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  INTERNAL = 'INTERNAL',
}

/**
 * Get error details by code
 */
export function getErrorDetails(code: string) {
  for (const [key, value] of Object.entries(ERROR_CODES)) {
    if (value.code === code) {
      return value;
    }
  }
  return ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Categorize error by code
 */
export function categorizeError(code: string): ErrorCategory {
  if (code.startsWith('AUTH_')) {
    return code === 'AUTH_003' ? ErrorCategory.AUTHORIZATION : ErrorCategory.AUTHENTICATION;
  }
  if (code.startsWith('VAL_')) return ErrorCategory.VALIDATION;
  if (code.startsWith('RLM_')) return ErrorCategory.RATE_LIMIT;
  if (code.startsWith('CNF_')) return ErrorCategory.CONFLICT;
  if (code.startsWith('DB_')) return ErrorCategory.DATABASE;
  if (code.startsWith('EXT_')) return ErrorCategory.EXTERNAL_SERVICE;
  if (code.startsWith('TIM_')) return ErrorCategory.TIMEOUT;
  if (code.endsWith('_NOT_FOUND')) return ErrorCategory.NOT_FOUND;

  return ErrorCategory.INTERNAL;
}
