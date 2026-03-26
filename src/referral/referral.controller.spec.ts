import { Test, TestingModule } from '@nestjs/testing';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import {
  ReferralStatus,
  WaitlistReferral,
} from './entities/waitlist-referral.entity';
import { PointsReason } from './entities/waitlist-referral-points.entity';

describe('ReferralController', () => {
  let controller: ReferralController;
  let service: jest.Mocked<ReferralService>;

  const mockReferral: WaitlistReferral = {
    id: 1,
    referrerId: 1,
    refereeId: 2,
    referralCode: 'ABC123XY',
    status: ReferralStatus.VERIFIED,
    refereeIP: '192.168.1.1',
    verifiedAt: new Date(),
    rewardedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    referrer: null as any,
    referee: null as any,
  };

  beforeEach(async () => {
    const mockService = {
      createReferral: jest.fn(),
      processReferralCallback: jest.fn(),
      getUserReferralStats: jest.fn(),
      getUserReferrals: jest.fn(),
      getReferralByCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReferralController],
      providers: [{ provide: ReferralService, useValue: mockService }],
    }).compile();

    controller = module.get<ReferralController>(ReferralController);
    service = module.get(ReferralService);
  });

  describe('createReferral', () => {
    it('should create a referral', async () => {
      const dto = { referrerId: 1, refereeId: 2 };
      service.createReferral.mockResolvedValue(mockReferral);

      const result = await controller.createReferral(dto);

      expect(service.createReferral).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockReferral);
    });
  });

  describe('referralCallback', () => {
    it('should process referral callback', async () => {
      const dto = {
        referrerId: 1,
        refereeId: 2,
        referralCode: 'ABC123XY',
        refereeIP: '192.168.1.1',
      };
      const callbackResult = { referral: mockReferral, points: null };
      service.processReferralCallback.mockResolvedValue(callbackResult);

      const result = await controller.referralCallback(dto);

      expect(service.processReferralCallback).toHaveBeenCalledWith(dto);
      expect(result).toEqual(callbackResult);
    });
  });

  describe('getUserReferralStats', () => {
    it('should get user referral stats', async () => {
      const stats = {
        userId: 1,
        totalReferrals: 5,
        verifiedReferrals: 3,
        totalPoints: 3,
        pointsHistory: [],
      };
      service.getUserReferralStats.mockResolvedValue(stats);

      const result = await controller.getUserReferralStats(1);

      expect(service.getUserReferralStats).toHaveBeenCalledWith(1);
      expect(result).toEqual(stats);
    });
  });

  describe('getUserReferrals', () => {
    it('should get user referrals list', async () => {
      service.getUserReferrals.mockResolvedValue([mockReferral]);

      const result = await controller.getUserReferrals(1);

      expect(service.getUserReferrals).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('getReferralsByCode', () => {
    it('should get referrals by code', async () => {
      service.getReferralByCode.mockResolvedValue([mockReferral]);

      const result = await controller.getReferralsByCode('ABC123XY');

      expect(service.getReferralByCode).toHaveBeenCalledWith('ABC123XY');
      expect(result).toHaveLength(1);
    });
  });
});
