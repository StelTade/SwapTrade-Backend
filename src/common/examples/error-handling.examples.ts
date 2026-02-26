/**
 * Example implementations of error handling in services
 * This file demonstrates best practices for using custom exceptions
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InsufficientBalanceException,
  InvalidTradeException,
  ResourceNotFoundException,
  UnauthorizedAccessException,
  AuthenticationFailedException,
  DatabaseException,
  ValidationException,
  InvalidStateException,
} from '../exceptions';
import { ErrorLoggerService } from '../logging/error-logger.service';
import { Balance } from '../../balance/balance.entity';
import { Trade } from '../../trading/entities/trade.entity';
import { User } from '../../user/entities/user.entity';
import { CreateTradeDto } from '../../trading/dto/create-trade.dto';

/**
 * EXAMPLE 1: Balance Service with comprehensive error handling
 */
@Injectable()
export class BalanceServiceExample {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,

    private readonly errorLogger: ErrorLoggerService,
  ) {}

  /**
   * Deduct balance with proper error handling
   */
  async deductBalance(
    userId: string,
    asset: string,
    amount: number,
  ): Promise<any> {
    try {
      // Validate input
      if (amount <= 0) {
        throw new ValidationException({
          amount: ['Amount must be greater than 0'],
        });
      }

      if (!this.isValidAsset(asset)) {
        throw new ValidationException({
          asset: ['Invalid asset'],
        });
      }

      // Fetch current balance
      let balance = await this.balanceRepository.findOne({
        where: { userId, asset },
      });

      if (!balance) {
        throw new ResourceNotFoundException('Balance', `${userId}:${asset}`);
      }

      // Check sufficient balance
      if (balance.balance < amount) {
        throw new InsufficientBalanceException(
          asset,
          amount,
          balance.balance,
          {
            userId,
            requestedAmount: amount,
            availableAmount: balance.balance,
          },
        );
      }

      // Deduct balance
      balance.balance -= amount;

      try {
        await this.balanceRepository.save(balance);
      } catch (error) {
        throw new DatabaseException(
          'deduct',
          error instanceof Error ? error.message : 'Unknown error',
          { userId, asset, amount },
        );
      }

      return balance;
    } catch (error) {
      // Custom exceptions are automatically caught by GlobalExceptionFilter
      if (
        error instanceof InsufficientBalanceException ||
        error instanceof ResourceNotFoundException ||
        error instanceof ValidationException ||
        error instanceof DatabaseException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.errorLogger.logError(
        error,
        undefined,
        500,
        'BALANCE_DEDUCT_ERROR',
        { userId, asset, amount },
      );

      throw new DatabaseException(
        'deduct',
        'An unexpected error occurred',
        { userId, asset },
      );
    }
  }

  /**
   * Get balance with not found handling
   */
  async getBalance(userId: string, asset: string): Promise<number> {
    try {
      const balance = await this.balanceRepository.findOne({
        where: { userId, asset },
      });

      if (!balance) {
        throw new ResourceNotFoundException('Balance', `${userId}:${asset}`);
      }

      return balance.balance;
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }

      throw new DatabaseException(
        'getBalance',
        error instanceof Error ? error.message : 'Unknown error',
        { userId, asset },
      );
    }
  }

  private isValidAsset(asset: string): boolean {
    const validAssets = ['BTC', 'ETH', 'USD', 'EUR'];
    return validAssets.includes(asset.toUpperCase());
  }
}

/**
 * EXAMPLE 2: Trading Service with state validation
 */
@Injectable()
export class TradingServiceExample {
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<any>,
    private readonly errorLogger: ErrorLoggerService,
  ) {}

  /**
   * Execute trade with comprehensive validation
   */
  async executeTrade(userId: string, tradeDto: any): Promise<any> {
    try {
      // Validate trade parameters
      if (tradeDto.fromAsset === tradeDto.toAsset) {
        throw new InvalidTradeException(
          'Cannot trade the same asset for itself',
        );
      }

      if (tradeDto.amount <= 0) {
        throw new ValidationException({
          amount: ['Amount must be greater than 0'],
        });
      }

      // Fetch existing trade
      let trade = await this.tradeRepository.findOne({
        where: { id: tradeDto.id },
      });

      if (!trade) {
        throw new ResourceNotFoundException('Trade', tradeDto.id);
      }

      // Validate state transition
      const currentState = trade.status;
      if (currentState !== 'PENDING') {
        throw new InvalidStateException('PENDING', 'EXECUTING', {
          currentState,
          tradeId: trade.id,
        });
      }

      // Execute trade logic
      try {
        trade.status = 'EXECUTING';
        await this.tradeRepository.save(trade);

        // Perform actual trade execution...
        const result = await this.performTrade(trade);

        trade.status = 'COMPLETED';
        trade.completedAt = new Date();
        await this.tradeRepository.save(trade);

        return trade;
      } catch (error) {
        // Revert to previous state on failure
        trade.status = 'FAILED';
        trade.error = error instanceof Error ? error.message : 'Unknown error';
        await this.tradeRepository.save(trade);

        throw new InvalidTradeException(
          `Trade execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { tradeId: trade.id, originalError: error },
        );
      }
    } catch (error) {
      if (
        error instanceof InvalidTradeException ||
        error instanceof ResourceNotFoundException ||
        error instanceof ValidationException ||
        error instanceof InvalidStateException
      ) {
        throw error;
      }

      this.errorLogger.logError(
        error,
        undefined,
        500,
        'TRADE_EXECUTION_ERROR',
        { userId, tradeId: tradeDto.id },
      );

      throw new DatabaseException(
        'executeTrade',
        'An unexpected error occurred',
        { userId, tradeId: tradeDto.id },
      );
    }
  }

  private async performTrade(trade: Trade): Promise<any> {
    // Implementation details...
    return {};
  }
}

/**
 * EXAMPLE 3: Auth Service with security error handling
 */
@Injectable()
export class AuthServiceExample {
  private loginAttempts: Map<string, { count: number; timestamp: number }> =
    new Map();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<any>,
    private readonly errorLogger: ErrorLoggerService,
  ) {}

  /**
   * Login with rate limiting and error handling
   */
  async login(email: string, password: string): Promise<{ token: string }> {
    try {
      // Validate input
      if (!email || !password) {
        throw new ValidationException({
          email: email ? undefined : ['Email is required'],
          password: password ? undefined : ['Password is required'],
        });
      }

      // Check rate limiting
      this.checkRateLimit(email);

      // Find user
      const user = await this.userRepository.findOne({
        where: { email },
      });

      if (!user) {
        // Don't reveal user doesn't exist (security)
        throw new AuthenticationFailedException(
          'Invalid email or password',
        );
      }

      // Validate password
      const passwordValid = await this.comparePassword(password, user.password);

      if (!passwordValid) {
        this.recordFailedAttempt(email);
        throw new AuthenticationFailedException(
          'Invalid email or password',
        );
      }

      // Reset failed attempts on successful login
      this.loginAttempts.delete(email);

      // Generate token
      const token = this.generateToken(user);

      return { token };
    } catch (error) {
      if (
        error instanceof AuthenticationFailedException ||
        error instanceof ValidationException
      ) {
        throw error;
      }

      this.errorLogger.logError(
        error,
        undefined,
        500,
        'LOGIN_ERROR',
        { email },
      );

      throw new DatabaseException(
        'login',
        'An unexpected error occurred during authentication',
      );
    }
  }

  /**
   * Verify user authorization
   */
  async verifyUserAccess(
    userId: string,
    resourceOwnerId: string,
  ): Promise<void> {
    if (userId !== resourceOwnerId) {
      throw new UnauthorizedAccessException(
        `access resource owned by ${resourceOwnerId}`,
        { userId, resourceOwnerId },
      );
    }
  }

  private checkRateLimit(email: string): void {
    const MAX_ATTEMPTS = 5;
    const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

    const attempts = this.loginAttempts.get(email);

    if (attempts) {
      const timeSinceFirstAttempt = Date.now() - attempts.timestamp;

      if (timeSinceFirstAttempt < LOCK_TIME && attempts.count >= MAX_ATTEMPTS) {
        const remainingTime = Math.ceil(
          (LOCK_TIME - timeSinceFirstAttempt) / 1000,
        );
        throw new Error(
          `Account temporarily locked. Try again in ${remainingTime} seconds`,
        );
      }

      if (timeSinceFirstAttempt >= LOCK_TIME) {
        this.loginAttempts.delete(email);
      }
    }
  }

  private recordFailedAttempt(email: string): void {
    const attempts = this.loginAttempts.get(email);

    if (attempts) {
      attempts.count++;
    } else {
      this.loginAttempts.set(email, {
        count: 1,
        timestamp: Date.now(),
      });
    }
  }

  private comparePassword(password: string, hash: string): Promise<boolean> {
    // Implementation using bcrypt
    return Promise.resolve(true);
  }

  private generateToken(user: User): string {
    // Implementation using JWT
    return 'token';
  }
}

/**
 * EXAMPLE 4: Generic async error handling pattern
 */
export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  context: string,
  errorLogger: ErrorLoggerService,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Log the error with context
    errorLogger.logError(
      error,
      undefined,
      500,
      `${context}_ERROR`,
      { context },
    );

    // Re-throw custom exceptions or convert to appropriate exception
    if (error instanceof (InsufficientBalanceException || InvalidTradeException)) {
      throw error;
    }

    throw new DatabaseException(
      context,
      error instanceof Error ? error.message : 'An unexpected error occurred',
    );
  }
}

/**
 * EXAMPLE 5: Validation utility with error handling
 */
export class ValidationUtil {
  static validatePositiveNumber(
    value: any,
    fieldName: string,
  ): void {
    if (typeof value !== 'number' || value <= 0) {
      throw new ValidationException({
        [fieldName]: [`${fieldName} must be a positive number`],
      });
    }
  }

  static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationException({
        email: ['Invalid email format'],
      });
    }
  }

  static validateRequired(
    value: any,
    fieldName: string,
  ): void {
    if (!value) {
      throw new ValidationException({
        [fieldName]: [`${fieldName} is required`],
      });
    }
  }

  static validateLength(
    value: string,
    minLength: number,
    fieldName: string,
  ): void {
    if (value.length < minLength) {
      throw new ValidationException({
        [fieldName]: [
          `${fieldName} must be at least ${minLength} characters`,
        ],
      });
    }
  }
}

// Note: using real entity/DTO imports above for runtime usage in examples
