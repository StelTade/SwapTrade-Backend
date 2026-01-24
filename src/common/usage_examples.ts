// Example 1: Trade Service with Audit Logging
// src/trades/trades.service.ts
import { Injectable } from '@nestjs/common';
import { LoggerService } from './logging/logger_service';
import { AuditService } from './logging/audit_service';
import { MetricsService } from './logging/metrics_service';

@Injectable()
export class TradesService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService,
  ) {}

  async executeTrade(tradeData: any) {
    const startTime = Date.now();
    
    try {
      this.logger.log('Executing trade', {
        userId: tradeData.userId,
        symbol: tradeData.symbol,
        quantity: tradeData.quantity,
      });

      // Execute trade logic
      const result = await this.performTradeExecution(tradeData);

      // Log audit trail
      this.auditService.logTradeExecution({
        tradeId: result.id,
        userId: tradeData.userId,
        symbol: tradeData.symbol,
        quantity: tradeData.quantity,
        price: result.executionPrice,
        side: tradeData.side,
        status: result.status,
      });

      // Record performance metric
      const duration = Date.now() - startTime;
      this.metricsService.recordRequestDuration('trade_execution', duration);

      this.logger.log('Trade executed successfully', {
        tradeId: result.id,
        duration,
      });

      return result;
    } catch (error) {
      this.logger.error('Trade execution failed', error.stack, {
        userId: tradeData.userId,
        symbol: tradeData.symbol,
        error: error.message,
      });

      this.metricsService.recordError('trade_execution', 500);
      throw error;
    }
  }

  private async performTradeExecution(tradeData: any) {
    // Simulated trade execution
    return {
      id: 'trade-123',
      executionPrice: 100.50,
      status: 'FILLED',
    };
  }
}


// Example 2: Balance Service with Audit Logging
// src/balances/balances.service.ts
import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/logging/audit.service';
import { LoggerService } from '../common/logging/logger.service';

@Injectable()
export class BalancesService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditService: AuditService,
  ) {}

  async updateBalance(
    userId: string,
    accountId: string,
    amount: number,
    currency: string,
    reason: string,
  ) {
    const previousBalance = await this.getBalance(accountId);
    const newBalance = previousBalance + amount;

    // Update balance in database
    await this.saveBalance(accountId, newBalance);

    // Log audit trail
    this.auditService.logBalanceUpdate({
      userId,
      accountId,
      currency,
      previousBalance,
      newBalance,
      amount,
      reason,
    });

    this.logger.log('Balance updated', {
      userId,
      accountId,
      amount,
      newBalance,
    });

    return newBalance;
  }

  private async getBalance(accountId: string): Promise<number> {
    return 1000; // Simulated
  }

  private async saveBalance(accountId: string, balance: number) {
    // Simulated save
  }
}


// Example 3: Auth Service with Login Audit
// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { AuditService } from './logging/audit_service';
import { LoggerService } from './logging/logger_service';

@Injectable()
export class AuthService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditService: AuditService,
  ) {}

  async login(email: string, password: string, req: any) {
    try {
      const user = await this.validateUser(email, password);
      
      if (!user) {
        // Log failed attempt
        this.auditService.logLoginAttempt(
          email,
          false,
          req.ip,
          req.headers['user-agent'],
        );
        
        throw new Error('Invalid credentials');
      }

      // Log successful login
      this.auditService.logLoginAttempt(
        user.id,
        true,
        req.ip,
        req.headers['user-agent'],
      );

      this.logger.log('User logged in', { userId: user.id });
      
      return this.generateToken(user);
    } catch (error) {
      this.logger.error('Login failed', error.stack, { email });
      throw error;
    }
  }

  private async validateUser(email: string, password: string) {
    // Simulated validation
    return { id: 'user-123', email };
  }

  private generateToken(user: any) {
    return { token: 'jwt-token' };
  }
}


// Example 4: Database Query with Performance Logging
// src/common/database/query.interceptor.ts
import { Injectable } from '@nestjs/common';
import { MetricsService } from './logging/metrics_service';

@Injectable()
export class QueryPerformanceTracker {
  constructor(private readonly metricsService: MetricsService) {}

  async trackQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      this.metricsService.recordQueryDuration(queryName, duration);
      
      return result;
    } catch (error) {
      throw error;
    }
  }
}


// Example 5: Using Context in Custom Decorators
// src/common/decorators/log-execution.decorator.ts
import { LoggerService } from './logging/logger_service';

export function LogExecution() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const logger = this.logger as LoggerService;
      const startTime = Date.now();

      try {
        logger.debug(`Executing ${propertyKey}`, {
          method: propertyKey,
          args: args.length,
        });

        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        logger.debug(`Completed ${propertyKey}`, {
          method: propertyKey,
          duration,
        });

        return result;
      } catch (error) {
        logger.error(`Error in ${propertyKey}`, error.stack, {
          method: propertyKey,
        });
        throw error;
      }
    };

    return descriptor;
  };
}