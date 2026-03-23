import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReferralService } from './referral.service';
import { Referral, ReferralStatus } from '../entities/referral.entity';
import { RewardConfig, RewardType } from '../entities/reward-config.entity';
import { RewardDistribution } from '../entities/reward-distribution.entity';
import { UserBalance } from '../../balance/entities/user-balance.entity';
import { BalanceAudit } from '../../balance/balance-audit.entity';
import { User } from '../../user/entities/user.entity';
import { VirtualAsset } from '../../trading/entities/virtual-asset.entity';
import { UserBadgeService } from '../../rewards/services/user-badge.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('ReferralService', () => {
  let service: ReferralService;
  let referralRepo: Repository<Referral>;
  let rewardConfigRepo: Repository<RewardConfig>;
  let distributionRepo: Repository<RewardDistribution>;
  let balanceRepo: Repository<UserBalance>;
  let auditRepo: Repository<BalanceAudit>;
  let userRepo: Repository<User>;
  let assetRepo: Repository<VirtualAsset>;
  let userBadgeService: UserBadgeService;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        {
          provide: getRepositoryToken(Referral),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(RewardConfig),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(RewardDistribution),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(UserBalance),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(BalanceAudit),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(VirtualAsset),
          useClass: Repository,
        },
        {
          provide: UserBadgeService,
          useValue: {
            evaluateAndAwardForUser: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
    referralRepo = module.get<Repository<Referral>>(getRepositoryToken(Referral));
    rewardConfigRepo = module.get<Repository<RewardConfig>>(
      getRepositoryToken(RewardConfig),
    );
    distributionRepo = module.get<Repository<RewardDistribution>>(
      getRepositoryToken(RewardDistribution),
    );
    balanceRepo = module.get<Repository<UserBalance>>(
      getRepositoryToken(UserBalance),
    );
    auditRepo = module.get<Repository<BalanceAudit>>(
      getRepositoryToken(BalanceAudit),
    );
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    assetRepo = module.get<Repository<VirtualAsset>>(
      getRepositoryToken(VirtualAsset),
    );
    userBadgeService = module.get<UserBadgeService>(UserBadgeService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReferral', () => {
    it('should create a new referral successfully', async () => {
      const dto = {
        referrerId: 1,
        refereeId: 2,
        referralCode: 'CODE123',
      };

      jest.spyOn(referralRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(referralRepo, 'create').mockReturnValue({
        id: 1,
        ...dto,
        status: ReferralStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Referral);
      jest.spyOn(referralRepo, 'save').mockResolvedValue({
        id: 1,
        ...dto,
        status: ReferralStatus.PENDING,
      } as Referral);

      const result = await service.createReferral(dto);

      expect(result).toBeDefined();
      expect(result.referrerId).toBe(dto.referrerId);
      expect(result.refereeId).toBe(dto.refereeId);
      expect(result.status).toBe(ReferralStatus.PENDING);
    });

    it('should throw BadRequestException if referee already has a referrer', async () => {
      const dto = {
        referrerId: 1,
        refereeId: 2,
        referralCode: 'CODE123',
      };

      jest.spyOn(referralRepo, 'findOne').mockResolvedValue({
        id: 1,
        referrerId: 3,
        refereeId: 2,
        referralCode: 'OLD_CODE',
        status: ReferralStatus.PENDING,
      } as Referral);

      await expect(service.createReferral(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if trying to refer yourself', async () => {
      const dto = {
        referrerId: 1,
        refereeId: 1,
        referralCode: 'CODE123',
      };

      await expect(service.createReferral(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyReferral', () => {
    it('should verify referral and distribute rewards', async () => {
      const dto = { refereeId: 2 };
      const referral = {
        id: 1,
        referrerId: 1,
        refereeId: 2,
        referralCode: 'CODE123',
        status: ReferralStatus.PENDING,
        referrer: { id: 1, username: 'referrer' },
        referee: { id: 2, username: 'referee' },
      } as Referral;

      jest.spyOn(referralRepo, 'findOne').mockResolvedValue(referral);
      jest.spyOn(referralRepo, 'save').mockResolvedValue(referral);
      jest.spyOn(service as any, 'distributeRewards').mockResolvedValue([]);

      const result = await service.verifyReferral(dto);

      expect(result.referral.status).toBe(ReferralStatus.VERIFIED);
      expect(result.referral.verifiedAt).toBeDefined();
    });

    it('should throw BadRequestException if referral not found', async () => {
      const dto = { refereeId: 999 };

      jest.spyOn(referralRepo, 'findOne').mockResolvedValue(null);

      await expect(service.verifyReferral(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if referral already verified', async () => {
      const dto = { refereeId: 2 };
      const referral = {
        id: 1,
        referrerId: 1,
        refereeId: 2,
        status: ReferralStatus.VERIFIED,
      } as Referral;

      jest.spyOn(referralRepo, 'findOne').mockResolvedValue(referral);

      await expect(service.verifyReferral(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getReferralByRefereeId', () => {
    it('should return referral by referee ID', async () => {
      const referral = {
        id: 1,
        referrerId: 1,
        refereeId: 2,
      } as Referral;

      jest.spyOn(referralRepo, 'findOne').mockResolvedValue(referral);

      const result = await service.getReferralByRefereeId(2);

      expect(result).toEqual(referral);
    });
  });

  describe('getReferralsByReferrerId', () => {
    it('should return all referrals for a referrer', async () => {
      const referrals = [
        { id: 1, referrerId: 1, refereeId: 2 },
        { id: 2, referrerId: 1, refereeId: 3 },
      ] as Referral[];

      jest.spyOn(referralRepo, 'find').mockResolvedValue(referrals);

      const result = await service.getReferralsByReferrerId(1);

      expect(result).toEqual(referrals);
      expect(result.length).toBe(2);
    });
  });
});
