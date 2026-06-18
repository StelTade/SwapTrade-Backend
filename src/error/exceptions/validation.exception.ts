import { HttpStatus } from '@nestjs/common';
import { StructuredException } from '../errors/structured.exception';
import { ERROR_CODES } from '../constants/error-codes';

export class ValidationException extends StructuredException {
  constructor(
    code: keyof typeof ERROR_CODES = 'VALIDATION_INVALID_INPUT_400',
    details?: Record<string, any>,
    requestId?: string,
  ) {
    const errorDef = ERROR_CODES[code];
    super(
      errorDef.code,
      errorDef.message,
      errorDef.httpStatus,
      details,
      requestId,
      errorDef.retryable,
    );
  }

  static invalidInput(
    details?: Record<string, any>,
    requestId?: string,
  ): ValidationException {
    return new ValidationException(
      'VALIDATION_INVALID_INPUT_400',
      details,
      requestId,
    );
  }

  static missingRequiredField(
    details?: Record<string, any>,
    requestId?: string,
  ): ValidationException {
    return new ValidationException(
      'VALIDATION_MISSING_REQUIRED_FIELD_400',
      details,
      requestId,
    );
  }

  static invalidFormat(
    details?: Record<string, any>,
    requestId?: string,
  ): ValidationException {
    return new ValidationException(
      'VALIDATION_INVALID_FORMAT_400',
      details,
      requestId,
    );
  }
}
