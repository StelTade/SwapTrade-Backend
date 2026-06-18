import { Injectable } from '@nestjs/common';
import { ErrorCodeRegistry } from './error-code.registry';

@Injectable()
export class ErrorService {
  /**
   * Get all error codes with their definitions
   */
  getAllErrorCodes() {
    return {
      errorCodes: ErrorCodeRegistry.getSortedErrorCodes(),
      categories: ErrorCodeRegistry.getCategories(),
      total: Object.keys(ErrorCodeRegistry.getAllErrorCodes()).length,
    };
  }

  /**
   * Get error codes by category
   */
  getErrorCodesByCategory(category: string) {
    return ErrorCodeRegistry.getErrorCodesByCategory(category);
  }

  /**
   * Check if error code exists
   */
  hasErrorCode(code: string) {
    return ErrorCodeRegistry.hasErrorCode(code);
  }

  /**
   * Get error definition by code
   */
  getErrorDefinition(code: string) {
    if (ErrorCodeRegistry.hasErrorCode(code)) {
      return ErrorCodeRegistry.getErrorDefinition(code);
    }
    return null;
  }
}
