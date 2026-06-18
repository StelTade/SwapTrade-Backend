import { SecurityEventLoggerService } from './security-event-logger.service';
import { AuditEventType, AuditSeverity } from './audit-log.entity';

describe('SecurityEventLoggerService', () => {
  let service: SecurityEventLoggerService;
  const mockLog = jest.fn().mockResolvedValue({});

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SecurityEventLoggerService({ log: mockLog } as any);
  });

  describe('logKycUpdate', () => {
    it('should call auditLogService.log with KYC_UPDATE metadata', async () => {
      await service.logKycUpdate(
        'actor-1',
        'user-2',
        { status: 'pending' },
        { status: 'approved' },
        '1.2.3.4',
      );
      expect(mockLog).toHaveBeenCalledTimes(1);
      const arg = mockLog.mock.calls[0][0];
      expect(arg.entityType).toBe('kyc');
      expect(arg.entityId).toBe('user-2');
      expect(arg.beforeState).toEqual({ status: 'pending' });
      expect(arg.afterState).toEqual({ status: 'approved' });
    });
  });

  describe('logRoleChange', () => {
    it('should log with CRITICAL severity', async () => {
      await service.logRoleChange('admin-1', 'user-3', 'USER', 'ADMIN');
      const arg = mockLog.mock.calls[0][0];
      expect(arg.severity).toBe(AuditSeverity.CRITICAL);
      expect(arg.beforeState).toEqual({ role: 'USER' });
      expect(arg.afterState).toEqual({ role: 'ADMIN' });
    });
  });

  describe('logGovernanceAction', () => {
    it('should log governance actions with WARNING severity', async () => {
      await service.logGovernanceAction('admin-1', 'PROPOSAL_CREATED', {
        proposalId: 'p-1',
      });
      const arg = mockLog.mock.calls[0][0];
      expect(arg.severity).toBe(AuditSeverity.WARNING);
      expect(arg.entityType).toBe('governance');
      expect(arg.metadata?.action).toBe('PROPOSAL_CREATED');
    });
  });

  describe('logAuthEvent', () => {
    it('should log successful auth with INFO severity', async () => {
      await service.logAuthEvent(
        'user-1',
        AuditEventType.LOGIN,
        true,
        '127.0.0.1',
      );
      const arg = mockLog.mock.calls[0][0];
      expect(arg.severity).toBe(AuditSeverity.INFO);
      expect(arg.metadata?.success).toBe(true);
    });

    it('should log failed auth with WARNING severity', async () => {
      await service.logAuthEvent(
        'user-1',
        AuditEventType.LOGIN,
        false,
        '127.0.0.1',
      );
      const arg = mockLog.mock.calls[0][0];
      expect(arg.severity).toBe(AuditSeverity.WARNING);
      expect(arg.metadata?.success).toBe(false);
    });
  });

  describe('logSensitiveDataAccess', () => {
    it('should log sensitive data access with actor info', async () => {
      await service.logSensitiveDataAccess(
        'admin-1',
        'user',
        'user-42',
        '10.0.0.1',
      );
      const arg = mockLog.mock.calls[0][0];
      expect(arg.entityType).toBe('user');
      expect(arg.entityId).toBe('user-42');
      expect(arg.metadata?.action).toBe('SENSITIVE_DATA_ACCESS');
    });
  });

  describe('error resilience', () => {
    it('should not throw when auditLogService.log fails', async () => {
      mockLog.mockRejectedValueOnce(new Error('DB down'));
      await expect(
        service.logAuthEvent('user-1', AuditEventType.LOGIN, true),
      ).resolves.toBeUndefined();
    });
  });
});
