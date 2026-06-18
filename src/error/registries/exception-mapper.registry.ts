import { StructuredException } from '../errors/structured.exception';
import { ValidationException } from '../exceptions/validation.exception';
import { AuthenticationException } from '../exceptions/authentication.exception';
import { BlockchainException } from '../exceptions/blockchain.exception';
import { AIServiceException } from '../exceptions/ai-service.exception';
import { ExceptionMapping } from '../types/error-response.types';

/**
 * Exception Mapper Registry
 * Maps custom exceptions to deterministic error codes and HTTP status codes
 * Ensures all exceptions produce consistent API responses
 */
export class ExceptionMapperRegistry {
  private static readonly exceptionMappings: Map<string, ExceptionMapping> =
    new Map();

  /**
   * Register exception mappings during application initialization
   */
  static initialize(): void {
    // Validation Exceptions
    this.registerMapping(
      ValidationException,
      'VALIDATION_INVALID_INPUT_400',
      400,
    );

    // Authentication Exceptions
    this.registerMapping(
      AuthenticationException,
      'AUTH_INVALID_CREDENTIALS_401',
      401,
    );

    // Blockchain Exceptions
    this.registerMapping(
      BlockchainException,
      'BLOCKCHAIN_TRANSACTION_FAILED_500',
      500,
    );

    // AI Service Exceptions
    this.registerMapping(AIServiceException, 'AI_SERVICE_UNAVAILABLE_503', 503);

    // Generic NestJS Exceptions
    this.registerMapping(Error, 'INTERNAL_SERVER_ERROR_500', 500);
  }

  /**
   * Register an exception type mapping
   */
  private static registerMapping(
    exceptionType: any,
    errorCode: string,
    httpStatus: number,
  ): void {
    const typeName = exceptionType.name;
    this.exceptionMappings.set(typeName, {
      exceptionType: typeName,
      errorCode,
      httpStatus,
    });
  }

  /**
   * Get mapping for an exception type
   */
  static getMapping(exception: any): ExceptionMapping | undefined {
    const typeName = exception.constructor.name;
    return this.exceptionMappings.get(typeName);
  }

  /**
   * Check if exception type is registered
   */
  static isMapped(exception: any): boolean {
    return this.exceptionMappings.has(exception.constructor.name);
  }

  /**
   * Get all registered mappings
   */
  static getAllMappings(): ExceptionMapping[] {
    return Array.from(this.exceptionMappings.values());
  }

  /**
   * Get mapping count
   */
  static getMappingCount(): number {
    return this.exceptionMappings.size;
  }
}

// Auto-initialize on module load
ExceptionMapperRegistry.initialize();
