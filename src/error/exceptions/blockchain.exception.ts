import { HttpStatus } from '@nestjs/common';
import { StructuredException } from '../errors/structured.exception';
import { ERROR_CODES } from '../constants/error-codes';

export class BlockchainException extends StructuredException {
  constructor(
    code: keyof typeof ERROR_CODES = 'BLOCKCHAIN_TRANSACTION_FAILED_500',
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

  static transactionFailed(
    details?: Record<string, any>,
    requestId?: string,
  ): BlockchainException {
    return new BlockchainException(
      'BLOCKCHAIN_TRANSACTION_FAILED_500',
      details,
      requestId,
    );
  }

  static networkError(
    details?: Record<string, any>,
    requestId?: string,
  ): BlockchainException {
    return new BlockchainException(
      'BLOCKCHAIN_NETWORK_ERROR_503',
      details,
      requestId,
    );
  }

  static insufficientGas(
    details?: Record<string, any>,
    requestId?: string,
  ): BlockchainException {
    return new BlockchainException(
      'BLOCKCHAIN_INSUFFICIENT_GAS_400',
      details,
      requestId,
    );
  }
}
