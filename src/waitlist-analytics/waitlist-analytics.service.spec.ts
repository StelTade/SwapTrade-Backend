import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaitlistAnalyticsService } from './waitlist-analytics.service';
import { WaitlistUser, WaitlistStatus } from '../waitlist/entities/waitlist-user.entity';
import { MetricsService } from '../../metrics/metrics.service';

describe('WaitlistAnalyticsService', () => {
  let service: WaitlistAnalyticsService;
  let mockRepo: jest.Mocked<Repository<WaitlistUser>>;
  let mockMetricsService: jest.Mocked<MetricsService>;

  const mockWaitlistUser = {
    id: 'test-id',
    email: 'test@example.com',
    name: 'Test User',
    status: WaitlistStatus.VERIFIED,
    referralCode: 'TEST1234',
    referredBy: null,
    createdAt: new Date(),
    verifiedAt: new Date(),
  } as WaitlistUser;

  beforeEach(async () => {
    mockRepo = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    } as any;

    mockMetricsService = {
      setWaitlistMetrics: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistAnalyticsService,
        {
          provide: getRepositoryToken(WaitlistUser),
          useValue: mockRepo,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<WaitlistAnalyticsService>(WaitlistAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      mockRepo.count
        .mockResolvedValueOnce(100) // totalSignups
        .mockResolvedValueOnce(60) // verifiedUsers
        .mockResolvedValueOnce(30) // pendingUsers
        .mockResolvedValueOnce(10) // invitedUsers
        .mockResolvedValueOnce(25); // referralConversions

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockRepo.createQueryBuilder
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getStats(30);

      expect(result.totalSignups).toBe(100);
      expect(result.verifiedUsers).toBe(60);
      expect(result.pendingUsers).toBe(30);
      expect(result.invitedUsers).toBe(10);
      expect(result.referralConversions).toBe(25);
      expect(result.verificationRate).toBe(60);
      expect(result.referralConversionRate).toBe(25);
      expect(result.topReferrers).toEqual([]);
      expect(result.dailyTrends).toBeDefined();
      expect(mockMetricsService.setWaitlistMetrics).toHaveBeenCalled();
    });
  });

  describe('getTopReferrers', () => {
    it('should return top referrers sorted by referral count', async () => {
      const mockReferrers = [
        { referralCode: 'ABC12345', referralCount: '10', verifiedReferrals: '8' },
        { referralCode: 'DEF67890', referralCount: '5', verifiedReferrals: '3' },
      ];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockReferrers),
      };

      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTopReferrers(10);

      expect(result).toHaveLength(2);
      expect(result[0].referralCode).toBe('ABC12345');
      expect(result[0].referralCount).toBe(10);
      expect(result[0].verifiedReferrals).toBe(8);
    });
  });

  describe('getDailyTrends', () => {
    it('should return daily trends for specified days', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getDailyTrends(7);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSummaryStats', () => {
    it('should return summary stats including today stats', async () => {
      mockRepo.count
        .mockResolvedValueOnce(100) // totalSignups
        .mockResolvedValueOnce(60) // verifiedUsers
        .mockResolvedValueOnce(30) // pendingUsers
        .mockResolvedValueOnce(25) // referralConversions
        .mockResolvedValueOnce(5) // todaySignups
        .mockResolvedValueOnce(3); // todayVerifications

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSummaryStats();

      expect(result.totalSignups).toBe(100);
      expect(result.verifiedUsers).toBe(60);
      expect(result.verificationRate).toBe(60);
    });
  });
});
