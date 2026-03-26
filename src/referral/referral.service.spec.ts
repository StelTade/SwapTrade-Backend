import { Test, TestingModule } from '@nestjs/testing';
import { ReferralService } from './referral.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  WaitlistReferral,
  ReferralStatus,
} from './entities/waitlist-referral.entity';
import {
  WaitlistReferralPoints,
  PointsReason,
} from './entities/waitlist-referral-points.entity';
import { WaitlistService } from '../waitlist/waitlist.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ReferralService', () => {
  let service: ReferralService;
  let referralRepository: any;
  let pointsRepository: any;
  let waitlistService: any;

  const mockReferral: WaitlistReferral = {
    id: 1,
    referrerId: 1,
    refereeId: 2,
    referralCode: 'ABC123XY',
    status: ReferralStatus.PENDING,
    refereeIP: null,
    verifiedAt: null,
    rewardedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    referrer: null as any,
    referee: null as any,
  };

  const mockPoints: WaitlistReferralPoints = {
    id: 1,
    userId: 1,
    points: 1,
    reason: PointsReason.REFERRAL_SIGNUP,
    referralId: 1,
    referral: null,
    description: 'Referral signup bonus',
    transactionRef: 'TXN-123456',
    createdAt: new Date(),
    user: null as any,
  };

  beforeEach(async () => {
    referralRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) => Promise.resolve({ id: 1, ...dto })),
    };

    pointsRepository = {
      find: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) => Promise.resolve({ id: 1, ...dto })),
    };

    waitlistService = {
      getUserByReferralCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        {
          provide: getRepositoryToken(WaitlistReferral),
          useValue: referralRepository,
        },
        {
          provide: getRepositoryToken(WaitlistReferralPoints),
          useValue: pointsRepository,
        },
        {
          provide: WaitlistService,
          useValue: waitlistService,
        },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
  });

  describe('createReferral', () => {
    it('should create a new referral', async () => {
      referralRepository.findOne.mockResolvedValue(null);

      const result = await service.createReferral({
        referrerId: 1,
        refereeId: 2,
        referralCode: 'ABC123XY',
      });

      expect(result.referrerId).toBe(1);
      expect(result.refereeId).toBe(2);
      expect(result.status).toBe(ReferralStatus.PENDING);
    });

    it('should throw BadRequestException for self-referral', async () => {
      await expect(
        service.createReferral({
          referrerId: 1,
          refereeId: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate referral', async () => {
      referralRepository.findOne.mockResolvedValue(mockReferral);

      await expect(
        service.createReferral({
          referrerId: 1,
          refereeId: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processReferralCallback', () => {
    it('should process referral callback and award points', async () => {
      const referrer = { id: 1, referralCode: 'ABC123XY' };
      referralRepository.findOne.mockResolvedValue(null);
      waitlistService.getUserByReferralCode.mockResolvedValue(referrer);
      referralRepository.save.mockResolvedValue({
        ...mockReferral,
        status: ReferralStatus.REWARDED,
        rewardedAt: new Date(),
      });
      pointsRepository.save.mockResolvedValue(mockPoints);

      const result = await service.processReferralCallback({
        referralCode: 'ABC123XY',
        refereeId: 2,
        refereeIP: '192.168.1.1',
        referrerId: 1,
      });

      expect(result.referral.status).toBe(ReferralStatus.REWARDED);
      expect(pointsRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for self-referral', async () => {
      await expect(
        service.processReferralCallback({
          referrerId: 1,
          refereeId: 1,
          referralCode: 'ABC123XY',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid referral code', async () => {
      referralRepository.findOne.mockResolvedValue(null);
      waitlistService.getUserByReferralCode.mockResolvedValue(null);

      await expect(
        service.processReferralCallback({
          referralCode: 'INVALID',
          refereeId: 2,
          referrerId: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update existing pending referral to verified', async () => {
      const existingReferral = {
        ...mockReferral,
        status: ReferralStatus.PENDING,
      };
      referralRepository.findOne.mockResolvedValue(existingReferral);
      referralRepository.save.mockResolvedValue({
        ...existingReferral,
        status: ReferralStatus.VERIFIED,
        verifiedAt: new Date(),
      });

      const result = await service.processReferralCallback({
        referrerId: 1,
        refereeId: 2,
        referralCode: 'ABC123XY',
      });

      expect(result.referral.status).toBe(ReferralStatus.VERIFIED);
    });
  });

  describe('getUserReferralStats', () => {
    it('should return user referral statistics', async () => {
      referralRepository.find.mockResolvedValue([mockReferral]);
      pointsRepository.find.mockResolvedValue([mockPoints]);

      const result = await service.getUserReferralStats(1);

      expect(result.userId).toBe(1);
      expect(result.totalReferrals).toBe(1);
      expect(result.totalPoints).toBe(1);
      expect(result.pointsHistory).toHaveLength(1);
    });

    it('should return empty stats for user with no referrals', async () => {
      referralRepository.find.mockResolvedValue([]);
      pointsRepository.find.mockResolvedValue([]);

      const result = await service.getUserReferralStats(999);

      expect(result.totalReferrals).toBe(0);
      expect(result.totalPoints).toBe(0);
    });
  });

  describe('getUserReferrals', () => {
    it('should return list of user referrals', async () => {
      referralRepository.find.mockResolvedValue([mockReferral]);

      const result = await service.getUserReferrals(1);

      expect(result).toHaveLength(1);
      expect(referralRepository.find).toHaveBeenCalledWith({
        where: { referrerId: 1 },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getReferralByCode', () => {
    it('should return referrals by code', async () => {
      referralRepository.find.mockResolvedValue([mockReferral]);

      const result = await service.getReferralByCode('ABC123XY');

      expect(result).toHaveLength(1);
      expect(referralRepository.find).toHaveBeenCalledWith({
        where: { referralCode: 'ABC123XY' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getReferralById', () => {
    it('should return referral by ID', async () => {
      referralRepository.findOne.mockResolvedValue(mockReferral);

      const result = await service.getReferralById(1);

      expect(result).toEqual(mockReferral);
    });

    it('should throw NotFoundException if referral not found', async () => {
      referralRepository.findOne.mockResolvedValue(null);

      await expect(service.getReferralById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
