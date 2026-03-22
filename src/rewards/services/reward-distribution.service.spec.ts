/**
 * Reward Distribution Service 单元测试
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { RewardDistributionService } from './reward-distribution.service';
import { BalanceService } from '../../balance/balance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BalanceAudit } from '../../balance/balance-audit.entity';
import { DataSource } from 'typeorm';

describe('RewardDistributionService', () => {
  let service: RewardDistributionService;

  const mockBalanceService = {
    creditBalance: jest.fn(),
  };

  const mockAuditRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  beforeEach(async () => {
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardDistributionService,
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: getRepositoryToken(BalanceAudit),
          useValue: mockAuditRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<RewardDistributionService>(RewardDistributionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('distributeRewards', () => {
    it('应该成功分配奖励', async () => {
      const referrerId = 1;
      const refereeId = 2;

      mockBalanceService.creditBalance
        .mockResolvedValueOnce({ id: 100 }) // referrer
        .mockResolvedValueOnce({ id: 101 }); // referee

      const result = await service.distributeRewards(referrerId, refereeId);

      expect(result.success).toBe(true);
      expect(result.referrerTxId).toBe(100);
      expect(result.refereeTxId).toBe(101);
      expect(mockBalanceService.creditBalance).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('应该处理分配失败并回滚', async () => {
      const referrerId = 1;
      const refereeId = 2;

      mockBalanceService.creditBalance
        .mockResolvedValueOnce({ id: 100 })
        .mockRejectedValueOnce(new Error('余额不足'));

      const result = await service.distributeRewards(referrerId, refereeId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('余额不足');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getRewardConfig', () => {
    it('应该返回默认配置', () => {
      const config = service.getRewardConfig();

      expect(config).toEqual({
        referrerReward: 10.00,
        refereeReward: 5.00,
        xpBonus: 100,
        badgeId: 1,
      });
    });
  });

  describe('updateRewardConfig', () => {
    it('应该更新配置', () => {
      const newConfig = {
        referrerReward: 15.00,
        refereeReward: 7.50,
      };

      const result = service.updateRewardConfig(newConfig);

      expect(result.referrerReward).toBe(15.00);
      expect(result.refereeReward).toBe(7.50);
    });
  });
});
