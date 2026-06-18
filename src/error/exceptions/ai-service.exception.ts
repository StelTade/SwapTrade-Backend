import { HttpStatus } from '@nestjs/common';
import { StructuredException } from '../errors/structured.exception';
import { ERROR_CODES } from '../constants/error-codes';

export class AIServiceException extends StructuredException {
  constructor(
    code: keyof typeof ERROR_CODES = 'AI_SERVICE_UNAVAILABLE_503',
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

  static serviceUnavailable(
    details?: Record<string, any>,
    requestId?: string,
  ): AIServiceException {
    return new AIServiceException(
      'AI_SERVICE_UNAVAILABLE_503',
      details,
      requestId,
    );
  }

  static invalidRequest(
    details?: Record<string, any>,
    requestId?: string,
  ): AIServiceException {
    return new AIServiceException(
      'AI_SERVICE_INVALID_REQUEST_400',
      details,
      requestId,
    );
  }
}
