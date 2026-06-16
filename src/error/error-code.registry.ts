import { ERROR_CODES, ErrorCode, ErrorDefinition } from './error-codes';

/**
 * Error Code Registry
 * Provides utilities for working with error codes
 */
export class ErrorCodeRegistry {
  /**
   * Get error definition by code
   */
  static getErrorDefinition(code: ErrorCode) {
    return ERROR_CODES[code];
  }

  /**
   * Get all error codes
   */
  static getAllErrorCodes(): Record<ErrorCode, typeof ERROR_CODES[ErrorCode]> {
    return ERROR_CODES;
  }

  /**
   * Get error codes by category
   */
  static getErrorCodesByCategory(category: string): Record<string, typeof ERROR_CODES[ErrorCode]> {
    const result: Record<string, typeof ERROR_CODES[ErrorCode]> = {};

    for (const [key, value] of Object.entries(ERROR_CODES)) {
      if ((value as ErrorDefinition).category === category) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get all categories
   */
  static getCategories(): string[] {
    const categories = new Set<string>();
    for (const error of Object.values(ERROR_CODES)) {
      categories.add((error as ErrorDefinition).category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Check if error code exists
   */
  static hasErrorCode(code: string): code is ErrorCode {
    return code in ERROR_CODES;
  }

  /**
   * Get error codes sorted by category and severity
   */
  static getSortedErrorCodes(): Array<{ code: ErrorCode; definition: typeof ERROR_CODES[ErrorCode] }> {
    return Object.entries(ERROR_CODES)
      .map(([code, definition]) => ({ code: code as ErrorCode, definition }))
      .sort((a: { code: ErrorCode; definition: typeof ERROR_CODES[ErrorCode] }, 
              b: { code: ErrorCode; definition: typeof ERROR_CODES[ErrorCode] }) => {
        // Sort by category first
        if (a.definition.category !== b.definition.category) {
          return a.definition.category.localeCompare(b.definition.category);
        }
        // Then by HTTP status
        return a.definition.httpStatus - b.definition.httpStatus;
      });
  }
}