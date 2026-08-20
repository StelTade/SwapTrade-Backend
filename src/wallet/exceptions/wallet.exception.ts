import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

/**
 * Domain-specific factory helpers for wallet errors. Each returns a standard
 * Nest `HttpException` subclass so the global exception filter renders them
 * consistently — this keeps call sites expressive without coupling the wallet
 * module to the central structured-error registry used elsewhere.
 */
export class WalletException {
  static insufficientBalance(details?: {
    asset?: string;
    available?: number;
    requested?: number;
  }): BadRequestException {
    return new BadRequestException({
      code: 'WALLET_INSUFFICIENT_BALANCE',
      message: 'Insufficient available balance',
      ...details,
    });
  }

  static ledgerNotFound(asset?: string): NotFoundException {
    return new NotFoundException({
      code: 'WALLET_LEDGER_NOT_FOUND',
      message: asset
        ? `No wallet ledger found for asset ${asset}`
        : 'No wallet ledger found',
    });
  }

  static withdrawalNotFound(id?: string): NotFoundException {
    return new NotFoundException({
      code: 'WALLET_WITHDRAWAL_NOT_FOUND',
      message: id ? `Withdrawal ${id} not found` : 'Withdrawal not found',
    });
  }

  static invalidState(message: string): BadRequestException {
    return new BadRequestException({
      code: 'WALLET_INVALID_STATE',
      message,
    });
  }

  static invalidAddress(address?: string): BadRequestException {
    return new BadRequestException({
      code: 'WALLET_INVALID_ADDRESS',
      message: address
        ? `Invalid destination address: ${address}`
        : 'Invalid destination address',
    });
  }

  static twoFactorRequired(
    message = 'A valid 2FA token is required for this operation',
  ): ForbiddenException {
    return new ForbiddenException({
      code: 'WALLET_2FA_REQUIRED',
      message,
    });
  }

  static twoFactorNotEnabled(): ForbiddenException {
    return new ForbiddenException({
      code: 'WALLET_2FA_NOT_ENABLED',
      message:
        'Enable two-factor authentication before making a high-value withdrawal',
    });
  }

  static rateLimited(message: string): HttpException {
    return new HttpException(
      { code: 'WALLET_RATE_LIMITED', message },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  static unsupportedNetwork(network?: string): BadRequestException {
    return new BadRequestException({
      code: 'WALLET_UNSUPPORTED_NETWORK',
      message: network
        ? `Unsupported network: ${network}`
        : 'Unsupported network',
    });
  }
}
