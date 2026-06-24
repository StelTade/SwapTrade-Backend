import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InsuranceFundService } from './insurance-fund.service';
import { FundHealthService } from './fund-health.service';
import { InsuranceFund } from '../entities/insurance-fund.entity';
import { InsuranceFundTier } from '../entities/insurance-fund-tier.entity';
import { InsuranceTransaction } from '../entities/insurance-transaction.entity';
import { FundTier } from '../enums/fund-tier.enum';
import { InsuranceTxType } from '../enums/insurance-tx-type.enum';
import { FundHealthStatus } from '../enums/fund-health-status.enum';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ ...data, id: data.id ?? 1 })),
});

describe('InsuranceFundService', () => {
  let service: InsuranceFundService;
  let fundRepo: ReturnType<typeof mockRepo>;
  let tierRepo: ReturnType<typeof mockRepo>;
  let txRepo: ReturnType<typeof mockRepo>;
  let fundHealthService: { updateFundHealth: jest.Mock };

  beforeEach(async () => {
    fundHealthService = { updateFundHealth: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceFundService,
        {
          provide: FundHealthService,
          useValue: fundHealthService,
        },
        { provide: getRepositoryToken(InsuranceFund), useFactory: mockRepo },
        {
          provide: getRepositoryToken(InsuranceFundTier),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(InsuranceTransaction),
          useFactory: mockRepo,
        },
      ],
    }).compile();

    service = module.get(InsuranceFundService);
    fundRepo = module.get(getRepositoryToken(InsuranceFund));
    tierRepo = module.get(getRepositoryToken(InsuranceFundTier));
    txRepo = module.get(getRepositoryToken(InsuranceTransaction));
  });

  describe('recordTransaction', () => {
    it('should credit fund on fee contribution', async () => {
      fundRepo.findOne.mockResolvedValue({
        id: 1,
        balance: 50000,
        tier: { tier: FundTier.MEDIUM },
      });
      fundRepo.save.mockImplementation((f) => f);
      txRepo.save.mockImplementation((t) => ({ ...t, id: 'tx-1' }));

      const result = await service.recordTransaction(
        1,
        InsuranceTxType.FEE_CONTRIBUTION,
        100,
        { referenceId: 'trade-1' },
      );

      expect(result.fund.balance).toBe(50100);
      expect(result.transaction.type).toBe(InsuranceTxType.FEE_CONTRIBUTION);
      expect(fundHealthService.updateFundHealth).toHaveBeenCalledWith(1);
    });

    it('should debit fund on payout', async () => {
      fundRepo.findOne.mockResolvedValue({
        id: 1,
        balance: 50000,
        tier: { tier: FundTier.MEDIUM },
      });
      fundRepo.save.mockImplementation((f) => f);
      txRepo.save.mockImplementation((t) => ({ ...t, id: 'tx-2' }));

      const result = await service.recordTransaction(
        1,
        InsuranceTxType.PAYOUT,
        5000,
        { userId: 42 },
      );

      expect(result.fund.balance).toBe(45000);
      expect(result.transaction.balanceBefore).toBe(50000);
      expect(result.transaction.balanceAfter).toBe(45000);
    });
  });

  describe('contributeFromFees', () => {
    it('should record fee contribution with trade reference', async () => {
      fundRepo.findOne.mockResolvedValue({
        id: 1,
        balance: 10000,
        tier: { tier: FundTier.MEDIUM },
      });
      fundRepo.save.mockImplementation((f) => f);
      txRepo.save.mockImplementation((t) => ({ ...t, id: 'tx-3' }));

      const result = await service.contributeFromFees(1, 50, 'trade-abc');

      expect(result.transaction.referenceId).toBe('trade-abc');
      expect(result.transaction.type).toBe(InsuranceTxType.FEE_CONTRIBUTION);
    });
  });
});
