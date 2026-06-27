import { EventEmitter2 } from '@nestjs/event-emitter';
import { KycStatus } from '../../kyc/enum/kyc-status.enum';
import { KycRole } from '../../kyc/enum/kyc-role.enum';
import { IdentityKycService, KYC_EVENTS } from './identity-kyc.service';

const makeOperator = (role = KycRole.KYC_OPERATOR) => ({
  id: 99,
  roles: [role],
});

describe('IdentityKycService', () => {
  const makeService = () => {
    const record = { reviewedBy: '99' };
    const kycService = {
      updateStatus: jest.fn().mockResolvedValue(record),
      getRecord: jest.fn().mockResolvedValue(record),
    };
    const events = { emit: jest.fn() } as unknown as EventEmitter2;
    const service = new IdentityKycService(kycService as never, events);
    return { service, kycService, events };
  };

  it('submitKyc emits KYCSubmitted event', async () => {
    const { service, events } = makeService();
    await service.submitKyc(1, makeOperator());
    expect(events.emit).toHaveBeenCalledWith(
      KYC_EVENTS.SUBMITTED,
      expect.objectContaining({ userId: 1 }),
    );
  });

  it('approveKyc emits KYCApproved event', async () => {
    const { service, events } = makeService();
    await service.approveKyc(1, makeOperator(), 'ok');
    expect(events.emit).toHaveBeenCalledWith(
      KYC_EVENTS.APPROVED,
      expect.objectContaining({ userId: 1 }),
    );
  });

  it('rejectKyc emits KYCRejected event with reason', async () => {
    const { service, events } = makeService();
    await service.rejectKyc(1, makeOperator(), 'docs invalid');
    expect(events.emit).toHaveBeenCalledWith(
      KYC_EVENTS.REJECTED,
      expect.objectContaining({ userId: 1, reason: 'docs invalid' }),
    );
  });

  it('delegates getKycRecord to KycService', async () => {
    const { service, kycService } = makeService();
    await service.getKycRecord(1, makeOperator());
    expect(kycService.getRecord).toHaveBeenCalledWith(1, makeOperator());
  });

  it('does not emit event when underlying kycService throws', async () => {
    const { service, kycService, events } = makeService();
    kycService.updateStatus.mockRejectedValue(new Error('forbidden'));
    await expect(service.submitKyc(1, makeOperator())).rejects.toThrow();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('delegates to VERIFIED status on approveKyc', async () => {
    const { service, kycService } = makeService();
    await service.approveKyc(2, makeOperator(), 'all good');
    expect(kycService.updateStatus).toHaveBeenCalledWith(
      2,
      KycStatus.VERIFIED,
      makeOperator(),
      'all good',
    );
  });

  it('delegates to REJECTED status on rejectKyc', async () => {
    const { service, kycService } = makeService();
    await service.rejectKyc(3, makeOperator(), 'reason');
    expect(kycService.updateStatus).toHaveBeenCalledWith(
      3,
      KycStatus.REJECTED,
      makeOperator(),
      'reason',
    );
  });
});
