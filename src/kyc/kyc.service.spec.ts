import { ForbiddenException } from '@nestjs/common';
import { KycStatus } from './enum/kyc-status.enum';
import { KycRole } from './enum/kyc-role.enum';
import { KycService } from './kyc.service';

describe('KycService', () => {
  const createService = () => {
    const manager = {
      findOne: jest.fn(),
      save: jest.fn(async (_entity, value) => value),
    };
    const dataSource = {
      options: { type: 'sqlite' },
      transaction: jest.fn((callback) => callback(manager)),
    };
    const kycRepo = {
      findOne: jest.fn(),
    };
    const stateMachine = {
      validateTransition: jest.fn(),
    };

    const service = new KycService(
      kycRepo as never,
      dataSource as never,
      stateMachine as never,
    );

    return { service, manager, dataSource, kycRepo, stateMachine };
  };

  it('rejects a governance operator that calls KYC mutation directly', async () => {
    const { service, dataSource } = createService();

    await expect(
      service.updateStatus(
        2,
        KycStatus.IN_REVIEW,
        { id: 1, roles: [KycRole.GOVERNANCE_OPERATOR] },
        'review started',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects an actor with both governance and KYC roles', async () => {
    const { service, dataSource } = createService();

    await expect(
      service.updateStatus(
        2,
        KycStatus.IN_REVIEW,
        {
          id: 1,
          roles: [KycRole.GOVERNANCE_OPERATOR, KycRole.KYC_OPERATOR],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('updates only the KYC status review fields for a valid operator', async () => {
    const { service, manager, stateMachine } = createService();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const record = {
      id: 'record-1',
      userId: 2,
      status: KycStatus.PENDING,
      reviewedBy: null,
      notes: 'existing',
      createdAt,
    };

    manager.findOne.mockResolvedValue(record);

    const updated = await service.updateStatus(
      2,
      KycStatus.IN_REVIEW,
      { id: 1, roles: [KycRole.KYC_OPERATOR] },
      'review started',
    );

    expect(stateMachine.validateTransition).toHaveBeenCalledWith(
      KycStatus.PENDING,
      KycStatus.IN_REVIEW,
    );
    expect(updated).toMatchObject({
      id: 'record-1',
      userId: 2,
      status: KycStatus.IN_REVIEW,
      reviewedBy: '1',
      notes: 'review started',
      createdAt,
    });
  });

  it('rejects governance roles from direct KYC reads', async () => {
    const { service, kycRepo } = createService();

    await expect(
      service.getRecord(1, {
        id: 1,
        roles: [KycRole.GOVERNANCE_OPERATOR],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(kycRepo.findOne).not.toHaveBeenCalled();
  });
});
