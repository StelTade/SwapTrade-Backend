export interface ErrorDefinition {
  message: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  httpStatus: number;
}

export type ErrorCode = string;

export const ERROR_CODES: Record<ErrorCode, ErrorDefinition> = {
  // Example error codes - this file should contain all your error definitions
  UNKNOWN_ERROR: {
    message: 'An unknown error occurred',
    category: 'general',
    severity: 'high',
    httpStatus: 500,
  },
  VALIDATION_ERROR: {
    message: 'Validation failed',
    category: 'input',
    severity: 'medium',
    httpStatus: 400,
  },
};