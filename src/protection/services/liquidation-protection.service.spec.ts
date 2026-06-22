import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiquidationProtectionService } from './liquidation-protection.service';
import { InsuranceFundService } from './insurance-fund.service';
import { LiquidationEvent } from '../entities/liquidation-event.entity';
import { FundTier } from '../enums/fund-tier.enum';
import { InsuranceTxType } from '../enums/insurance-tx-type.enum';

describe('LiquidationProtectionService', () => {
  let service: LiquidationProtectionService;
  let insuranceFundService: {
    getFundsByTier: jest.Mock;
    recordTransaction: jest.Mock;
  };
  let liquidationRepo: { create: jest.Mock; save: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    insuranceFundService = {
      getFundsByTier: jest.fn(),
      recordTransaction: jest.fn(),
    };
    liquidationRepo = {
      create: jest.fn((d) => d),
      save: jest.fn((d) => ({ ...d, id: 'liq-1' })),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidationProtectionService,
        { provide: InsuranceFundService, useValue: insuranceFundService },
        {
          provide: getRepositoryToken(LiquidationEvent),
          useValue: liquidationRepo,
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(LiquidationProtectionService);
  });

  it('should cover full shortfall from insurance fund', async () => {
    insuranceFundService.getFundsByTier.mockResolvedValue({
      id: 1,
      balance: 100000,
      tier: { tier: FundTier.LOW },
    });
    insuranceFundService.recordTransaction.mockResolvedValue({
      fund: { id: 1, balance: 90000 },
      transaction: { id: 'tx-1' },
    });

    const result = await service.coverShortfall(1, 10000, 'pos-1');

    expect(result.coveredAmount).toBe(10000);
    expect(result.remainingShortfall).toBe(0);
    expect(result.cascadePrevented).toBe(true);
    expect(insuranceFundService.recordTransaction).toHaveBeenCalledWith(
      1,
      InsuranceTxType.PAYOUT,
      10000,
      expect.objectContaining({ userId: 1, referenceId: 'pos-1' }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'liquidation.shortfall',
      expect.any(Object),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'insurance.payout',
      expect.any(Object),
    );
  });

  it('should partially cover when fund balance is insufficient', async () => {
    insuranceFundService.getFundsByTier
      .mockResolvedValueOnce({
        id: 1,
        balance: 3000,
        tier: { tier: FundTier.LOW },
      })
      .mockResolvedValueOnce({
        id: 2,
        balance: 0,
        tier: { tier: FundTier.MEDIUM },
      })
      .mockRejectedValue(new Error('not found'));

    insuranceFundService.recordTransaction.mockResolvedValue({
      fund: { id: 1, balance: 0 },
      transaction: { id: 'tx-1' },
    });

    const result = await service.coverShortfall(2, 10000);

    expect(result.coveredAmount).toBe(3000);
    expect(result.remainingShortfall).toBe(7000);
    expect(result.cascadePrevented).toBe(false);
  });
});
