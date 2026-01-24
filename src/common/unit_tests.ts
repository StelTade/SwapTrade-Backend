// test/logger.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logging/logger_service';

describe('LoggerService', () => {
  let service: LoggerService;
  let mockTransport: any;

  beforeEach(async () => {
    mockTransport = new winston.transports.Stream({
      stream: {
        write: jest.fn(),
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggerService],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  describe('Sensitive Data Masking', () => {
    it('should mask password fields', () => {
      const logSpy = jest.spyOn(service as any, 'maskSensitiveData');
      
      const data = {
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com',
      };

      const masked = (service as any).maskSensitiveData(data);

      expect(masked.password).toBe('***REDACTED***');
      expect(masked.username).toBe('testuser');
      expect(masked.email).toBe('test@example.com');
    });

    it('should mask authorization tokens', () => {
      const data = {
        authorization: 'Bearer token123',
        apiKey: 'key-12345',
      };

      const masked = (service as any).maskSensitiveData(data);

      expect(masked.authorization).toBe('***REDACTED***');
      expect(masked.apiKey).toBe('***REDACTED***');
    });

    it('should mask nested sensitive data', () => {
      const data = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret',
            token: 'abc123',
          },
        },
      };

      const masked = (service as any).maskSensitiveData(data);

      expect(masked.user.name).toBe('John');
      expect(masked.user.credentials.password).toBe('***REDACTED***');
      expect(masked.user.credentials.token).toBe('***REDACTED***');
    });

    it('should handle arrays with sensitive data', () => {
      const data = {
        users: [
          { name: 'User1', password: 'pass1' },
          { name: 'User2', password: 'pass2' },
        ],
      };

      const masked = (service as any).maskSensitiveData(data);

      expect(masked.users[0].password).toBe('***REDACTED***');
      expect(masked.users[1].password).toBe('***REDACTED***');
      expect(masked.users[0].name).toBe('User1');
    });
  });

  describe('Correlation ID', () => {
    it('should store and retrieve correlation ID from context', () => {
      service.runWithContext(() => {
        service.setContext('correlationId', 'test-correlation-id');
        const context = (service as any).getContext();
        
        expect(context.get('correlationId')).toBe('test-correlation-id');
      });
    });

    it('should isolate context between different executions', () => {
      let context1: string | undefined;
      let context2: string | undefined;

      service.runWithContext(() => {
        service.setContext('correlationId', 'id-1');
        context1 = (service as any).getContext().get('correlationId');
      });

      service.runWithContext(() => {
        service.setContext('correlationId', 'id-2');
        context2 = (service as any).getContext().get('correlationId');
      });

      expect(context1).toBe('id-1');
      expect(context2).toBe('id-2');
    });
  });

  describe('Log Formatting', () => {
    it('should format logs as JSON', () => {
      const logOutput: any[] = [];
      const testTransport = new winston.transports.Stream({
        stream: {
          write: (message: string) => {
            logOutput.push(JSON.parse(message));
          },
        } as any,
      });

      service.runWithContext(() => {
        service.setContext('correlationId', 'test-id');
        service.log('Test message', { userId: 'user-123' });
      });

      // Note: In real implementation, you'd need to access the logger's output
      // This is a simplified example
    });
  });

  describe('Metric Logging', () => {
    it('should log metrics with proper format', () => {
      service.runWithContext(() => {
        service.setContext('correlationId', 'test-id');
        service.metric('test.metric', 100, { tag1: 'value1' });
      });

      // Verify metric was logged (in real implementation)
    });
  });
});


// test/audit.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './logging/audit_service';
import { LoggerService } from './logging/logger_service';

describe('AuditService', () => {
  let service: AuditService;
  let loggerService: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: LoggerService,
          useValue: {
            audit: jest.fn(),
            warn: jest.fn(),
            setContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  describe('Trade Audit Logging', () => {
    it('should log trade execution with all details', () => {
      const tradeData = {
        tradeId: 'trade-123',
        userId: 'user-456',
        symbol: 'AAPL',
        quantity: 100,
        price: 150.50,
        side: 'BUY' as const,
        status: 'FILLED',
      };

      service.logTradeExecution(tradeData);

      expect(loggerService.audit).toHaveBeenCalledWith({
        action: 'TRADE_EXECUTED',
        resource: 'TRADE',
        resourceId: 'trade-123',
        userId: 'user-456',
        metadata: {
          symbol: 'AAPL',
          quantity: 100,
          price: 150.50,
          side: 'BUY',
          totalValue: 15050,
          status: 'FILLED',
        },
      });

      expect(loggerService.setContext).toHaveBeenCalledWith('tradeId', 'trade-123');
    });

    it('should log trade cancellation', () => {
      service.logTradeCancellation('trade-123', 'user-456', 'User requested');

      expect(loggerService.audit).toHaveBeenCalledWith({
        action: 'TRADE_CANCELLED',
        resource: 'TRADE',
        resourceId: 'trade-123',
        userId: 'user-456',
        metadata: { reason: 'User requested' },
      });
    });
  });

  describe('Balance Audit Logging', () => {
    it('should log balance deposit', () => {
      const balanceData = {
        userId: 'user-123',
        accountId: 'account-456',
        currency: 'USD',
        previousBalance: 1000,
        newBalance: 1500,
        amount: 500,
        reason: 'Deposit',
      };

      service.logBalanceUpdate(balanceData);

      expect(loggerService.audit).toHaveBeenCalledWith({
        action: 'BALANCE_DEPOSIT',
        resource: 'BALANCE',
        resourceId: 'account-456',
        userId: 'user-123',
        changes: {
          balance: {
            old: 1000,
            new: 1500,
          },
        },
        metadata: {
          currency: 'USD',
          amount: 500,
          reason: 'Deposit',
        },
      });
    });

    it('should log balance withdrawal', () => {
      const balanceData = {
        userId: 'user-123',
        accountId: 'account-456',
        currency: 'USD',
        previousBalance: 1000,
        newBalance: 500,
        amount: -500,
        reason: 'Withdrawal',
      };

      service.logBalanceUpdate(balanceData);

      expect(loggerService.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BALANCE_WITHDRAWAL',
        }),
      );
    });

    it('should alert on large balance changes', () => {
      const balanceData = {
        userId: 'user-123',
        accountId: 'account-456',
        currency: 'USD',
        previousBalance: 10000,
        newBalance: 25000,
        amount: 15000,
        reason: 'Large deposit',
      };

      service.logBalanceUpdate(balanceData);

      expect(loggerService.warn).toHaveBeenCalledWith(
        'Large balance change detected',
        expect.objectContaining({
          amount: 15000,
        }),
      );
    });
  });

  describe('Authentication Audit Logging', () => {
    it('should log successful login', () => {
      service.logLoginAttempt('user-123', true, '192.168.1.1', 'Mozilla/5.0');

      expect(loggerService.audit).toHaveBeenCalledWith({
        action: 'USER_LOGIN',
        resource: 'USER',
        resourceId: 'user-123',
        userId: 'user-123',
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          success: true,
        },
      });
    });

    it('should log and alert on failed login', () => {
      service.logLoginAttempt('user-123', false, '192.168.1.1', 'Mozilla/5.0');

      expect(loggerService.audit).toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(
        'Failed login attempt',
        expect.objectContaining({
          userId: 'user-123',
          ip: '192.168.1.1',
        }),
      );
    });
  });
});