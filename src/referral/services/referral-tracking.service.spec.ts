/**
 * Referral Tracking Service 单元测试
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ReferralTrackingService } from './referral-tracking.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WaitlistReferral } from './entities/waitlist-referral.entity';
import { WaitlistReferralPoints } from './entities/waitlist-referral-points.entity';
import { DataSource } from 'typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('ReferralTrackingService', () => {
  let service: ReferralTrackingService;

  const mockReferralRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockPointsRepo = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
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
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralTrackingService,
        {
          provide: getRepositoryToken(WaitlistReferral),
          useValue: mockReferralRepo,
        },
        {
          provide: getRepositoryToken(WaitlistReferralPoints),
          useValue: mockPointsRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ReferralTrackingService>(ReferralTrackingService);
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('createReferral', () => {
    it('应该成功创建推荐关系', async () => {
      mockReferralRepo.findOne.mockResolvedValue(null);
      mockReferralRepo.create.mockReturnValue({ id: 1 });
      mockReferralRepo.save.mockResolvedValue({ id: 1 });

      const result = await service.createReferral({
        referrerId: 1,
        refereeId: 2,
      });

      expect(result.id).toBe(1);
      expect(mockReferralRepo.save).toHaveBeenCalled();
    });

    it('应该阻止自我推荐', async () => {
      await expect(
        service.createReferral({ referrerId: 1, refereeId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('应该阻止重复推荐', async () => {
      mockReferralRepo.findOne.mockResolvedValue({ id: 1 });

      await expect(
        service.createReferral({ referrerId: 1, refereeId: 2 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getUserReferralStats', () => {
    it('应该返回用户推荐统计', async () => {
      mockReferralRepo.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8)  // verified
        .mockResolvedValueOnce(8); // rewarded

      mockPointsRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: 8 }),
      });

      const stats = await service.getUserReferralStats(1);

      expect(stats).toEqual({
        totalReferrals: 10,
        verifiedReferrals: 8,
        rewardedReferrals: 8,
        totalPoints: 8,
      });
    });
  });
});
