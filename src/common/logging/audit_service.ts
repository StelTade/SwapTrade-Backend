// src/common/logging/audit.service.ts
import { Injectable } from '@nestjs/common';
import { LoggerService, AuditLogData } from './logger_service';

export enum AuditAction {
  TRADE_EXECUTED = 'TRADE_EXECUTED',
  TRADE_CANCELLED = 'TRADE_CANCELLED',
  BALANCE_UPDATED = 'BALANCE_UPDATED',
  BALANCE_WITHDRAWAL = 'BALANCE_WITHDRAWAL',
  BALANCE_DEPOSIT = 'BALANCE_DEPOSIT',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  USER_LOGOUT = 'USER_LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
}

export enum AuditResource {
  TRADE = 'TRADE',
  USER = 'USER',
  BALANCE = 'BALANCE',
  ACCOUNT = 'ACCOUNT',
  API_KEY = 'API_KEY',
}

interface TradeAuditData {
  tradeId: string;
  userId: string;
  symbol: string;
  quantity: number;
  price: number;
  side: 'BUY' | 'SELL';
  status: string;
}

interface BalanceAuditData {
  userId: string;
  accountId: string;
  currency: string;
  previousBalance: number;
  newBalance: number;
  amount: number;
  reason: string;
}

interface UserAuditData {
  userId: string;
  changes?: Record<string, { old: any; new: any }>;
  action: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly logger: LoggerService) {}

  logTradeExecution(data: TradeAuditData): void {
    const auditData: AuditLogData = {
      action: AuditAction.TRADE_EXECUTED,
      resource: AuditResource.TRADE,
      resourceId: data.tradeId,
      userId: data.userId,
      metadata: {
        symbol: data.symbol,
        quantity: data.quantity,
        price: data.price,
        side: data.side,
        totalValue: data.quantity * data.price,
        status: data.status,
      },
    };

    this.logger.audit(auditData);
    this.logger.setContext('tradeId', data.tradeId);
  }

  logTradeCancellation(tradeId: string, userId: string, reason: string): void {
    const auditData: AuditLogData = {
      action: AuditAction.TRADE_CANCELLED,
      resource: AuditResource.TRADE,
      resourceId: tradeId,
      userId,
      metadata: { reason },
    };

    this.logger.audit(auditData);
  }

  logBalanceUpdate(data: BalanceAuditData): void {
    const action = data.amount > 0 
      ? AuditAction.BALANCE_DEPOSIT 
      : AuditAction.BALANCE_WITHDRAWAL;

    const auditData: AuditLogData = {
      action,
      resource: AuditResource.BALANCE,
      resourceId: data.accountId,
      userId: data.userId,
      changes: {
        balance: {
          old: data.previousBalance,
          new: data.newBalance,
        },
      },
      metadata: {
        currency: data.currency,
        amount: Math.abs(data.amount),
        reason: data.reason,
      },
    };

    this.logger.audit(auditData);

    // Alert on large balance changes (> $10,000)
    if (Math.abs(data.amount) > 10000) {
      this.logger.warn('Large balance change detected', {
        userId: data.userId,
        amount: data.amount,
        currency: data.currency,
        reason: data.reason,
      });
    }
  }

  logUserCreation(userId: string, createdBy: string, userData: any): void {
    const auditData: AuditLogData = {
      action: AuditAction.USER_CREATED,
      resource: AuditResource.USER,
      resourceId: userId,
      userId: createdBy,
      metadata: {
        email: userData.email,
        role: userData.role,
      },
    };

    this.logger.audit(auditData);
  }

  logUserUpdate(data: UserAuditData): void {
    const auditData: AuditLogData = {
      action: AuditAction.USER_UPDATED,
      resource: AuditResource.USER,
      resourceId: data.userId,
      userId: data.userId,
      changes: data.changes,
    };

    this.logger.audit(auditData);
  }

  logUserDeletion(userId: string, deletedBy: string, reason: string): void {
    const auditData: AuditLogData = {
      action: AuditAction.USER_DELETED,
      resource: AuditResource.USER,
      resourceId: userId,
      userId: deletedBy,
      metadata: { reason },
    };

    this.logger.audit(auditData);
  }

  logLoginAttempt(userId: string, success: boolean, ip: string, userAgent: string): void {
    const action = success ? AuditAction.USER_LOGIN : AuditAction.USER_LOGIN_FAILED;
    
    const auditData: AuditLogData = {
      action,
      resource: AuditResource.USER,
      resourceId: userId,
      userId,
      metadata: {
        ip,
        userAgent,
        success,
      },
    };

    this.logger.audit(auditData);

    // Alert on failed login attempts
    if (!success) {
      this.logger.warn('Failed login attempt', {
        userId,
        ip,
      });
    }
  }

  logPasswordChange(userId: string, changedBy: string): void {
    const auditData: AuditLogData = {
      action: AuditAction.PASSWORD_CHANGED,
      resource: AuditResource.USER,
      resourceId: userId,
      userId: changedBy,
    };

    this.logger.audit(auditData);
  }

  logApiKeyCreation(userId: string, keyId: string, permissions: string[]): void {
    const auditData: AuditLogData = {
      action: AuditAction.API_KEY_CREATED,
      resource: AuditResource.API_KEY,
      resourceId: keyId,
      userId,
      metadata: { permissions },
    };

    this.logger.audit(auditData);
  }

  logApiKeyRevocation(userId: string, keyId: string, reason: string): void {
    const auditData: AuditLogData = {
      action: AuditAction.API_KEY_REVOKED,
      resource: AuditResource.API_KEY,
      resourceId: keyId,
      userId,
      metadata: { reason },
    };

    this.logger.audit(auditData);
  }
}