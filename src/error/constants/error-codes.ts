/**
 * Comprehensive error codes with hierarchical categorization
 * Pattern: [CATEGORY]_[SPECIFIC]_[SEVERITY]
 * Categories: AUTH, VALIDATION, BLOCKCHAIN, AI_SERVICE, DATABASE, RATE_LIMIT, EXTERNAL
 */

export const ERROR_CODES = {
  // Authentication & Authorization (AUTH_*)
  AUTH_TOKEN_EXPIRED_401: {
    code: 'AUTH_TOKEN_EXPIRED_401',
    message: 'Authentication token has expired',
    httpStatus: 401,
    category: 'AUTH',
    retryable: false,
  },
  AUTH_INVALID_CREDENTIALS_401: {
    code: 'AUTH_INVALID_CREDENTIALS_401',
    message: 'Invalid username or password',
    httpStatus: 401,
    category: 'AUTH',
    retryable: false,
  },
  AUTH_INSUFFICIENT_PERMISSIONS_403: {
    code: 'AUTH_INSUFFICIENT_PERMISSIONS_403',
    message: 'Insufficient permissions for this operation',
    httpStatus: 403,
    category: 'AUTH',
    retryable: false,
  },
  AUTH_TOKEN_MISSING_401: {
    code: 'AUTH_TOKEN_MISSING_401',
    message: 'Authentication token is required',
    httpStatus: 401,
    category: 'AUTH',
    retryable: false,
  },
  AUTH_TOKEN_INVALID_401: {
    code: 'AUTH_TOKEN_INVALID_401',
    message: 'Authentication token is invalid',
    httpStatus: 401,
    category: 'AUTH',
    retryable: false,
  },

  // Validation (VALIDATION_*)
  VALIDATION_INVALID_INPUT_400: {
    code: 'VALIDATION_INVALID_INPUT_400',
    message: 'Invalid input data provided',
    httpStatus: 400,
    category: 'VALIDATION',
    retryable: false,
  },
  VALIDATION_MISSING_REQUIRED_FIELD_400: {
    code: 'VALIDATION_MISSING_REQUIRED_FIELD_400',
    message: 'Required field is missing',
    httpStatus: 400,
    category: 'VALIDATION',
    retryable: false,
  },
  VALIDATION_INVALID_FORMAT_400: {
    code: 'VALIDATION_INVALID_FORMAT_400',
    message: 'Invalid data format',
    httpStatus: 400,
    category: 'VALIDATION',
    retryable: false,
  },

  // Blockchain (BLOCKCHAIN_*)
  BLOCKCHAIN_TRANSACTION_FAILED_500: {
    code: 'BLOCKCHAIN_TRANSACTION_FAILED_500',
    message: 'Blockchain transaction failed',
    httpStatus: 500,
    category: 'BLOCKCHAIN',
    retryable: true,
  },
  BLOCKCHAIN_NETWORK_ERROR_503: {
    code: 'BLOCKCHAIN_NETWORK_ERROR_503',
    message: 'Blockchain network is unavailable',
    httpStatus: 503,
    category: 'BLOCKCHAIN',
    retryable: true,
  },
  BLOCKCHAIN_INSUFFICIENT_GAS_400: {
    code: 'BLOCKCHAIN_INSUFFICIENT_GAS_400',
    message: 'Insufficient gas for transaction',
    httpStatus: 400,
    category: 'BLOCKCHAIN',
    retryable: false,
  },

  // AI Service (AI_SERVICE_*)
  AI_SERVICE_UNAVAILABLE_503: {
    code: 'AI_SERVICE_UNAVAILABLE_503',
    message: 'AI service is temporarily unavailable',
    httpStatus: 503,
    category: 'AI_SERVICE',
    retryable: true,
  },
  AI_SERVICE_INVALID_REQUEST_400: {
    code: 'AI_SERVICE_INVALID_REQUEST_400',
    message: 'Invalid request to AI service',
    httpStatus: 400,
    category: 'AI_SERVICE',
    retryable: false,
  },

  // Database (DATABASE_*)
  DATABASE_CONNECTION_ERROR_503: {
    code: 'DATABASE_CONNECTION_ERROR_503',
    message: 'Database connection failed',
    httpStatus: 503,
    category: 'DATABASE',
    retryable: true,
  },
  DATABASE_QUERY_TIMEOUT_504: {
    code: 'DATABASE_QUERY_TIMEOUT_504',
    message: 'Database query timed out',
    httpStatus: 504,
    category: 'DATABASE',
    retryable: true,
  },
  DATABASE_RECORD_NOT_FOUND_404: {
    code: 'DATABASE_RECORD_NOT_FOUND_404',
    message: 'Requested record not found',
    httpStatus: 404,
    category: 'DATABASE',
    retryable: false,
  },

  // Rate Limiting (RATE_LIMIT_*)
  RATE_LIMIT_EXCEEDED_429: {
    code: 'RATE_LIMIT_EXCEEDED_429',
    message: 'Rate limit exceeded, please try again later',
    httpStatus: 429,
    category: 'RATE_LIMIT',
    retryable: true,
  },

  // External Services (EXTERNAL_*)
  EXTERNAL_SERVICE_ERROR_502: {
    code: 'EXTERNAL_SERVICE_ERROR_502',
    message: 'External service returned an error',
    httpStatus: 502,
    category: 'EXTERNAL',
    retryable: true,
  },
  EXTERNAL_SERVICE_TIMEOUT_504: {
    code: 'EXTERNAL_SERVICE_TIMEOUT_504',
    message: 'External service request timed out',
    httpStatus: 504,
    category: 'EXTERNAL',
    retryable: true,
  },

  // Generic
  INTERNAL_SERVER_ERROR_500: {
    code: 'INTERNAL_SERVER_ERROR_500',
    message: 'An internal server error occurred',
    httpStatus: 500,
    category: 'INTERNAL',
    retryable: false,
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
