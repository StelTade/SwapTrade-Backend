import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { Referral, ReferralStatus } from '../src/referral/entities/referral.entity';
import { RewardConfig, RewardType } from '../src/referral/entities/reward-config.entity';
import { User } from '../src/user/entities/user.entity';
import { UserBalance } from '../src/balance/entities/user-balance.entity';
import { VirtualAsset } from '../src/trading/entities/virtual-asset.entity';

describe('Referral System (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let referralRepo: Repository<Referral>;
  let rewardConfigRepo: Repository<RewardConfig>;
  let userRepo: Repository<User>;
  let balanceRepo: Repository<UserBalance>;
  let assetRepo: Repository<VirtualAsset>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    referralRepo = dataSource.getRepository(Referral);
    rewardConfigRepo = dataSource.getRepository(RewardConfig);
    userRepo = dataSource.getRepository(User);
    balanceRepo = dataSource.getRepository(UserBalance);
    assetRepo = dataSource.getRepository(VirtualAsset);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database
    await referralRepo.delete({});
    await rewardConfigRepo.delete({});
    await balanceRepo.delete({});
    await userRepo.delete({});
    await assetRepo.delete({});

    // Create test users
    await userRepo.save([
      { id: 1, username: 'referrer', email: 'referrer@test.com', role: 'USER' },
      { id: 2, username: 'referee', email: 'referee@test.com', role: 'USER' },
    ]);

    // Create default reward configs
    await rewardConfigRepo.save([
      {
        rewardType: RewardType.BALANCE_CREDIT,
        recipientType: 'REFERRER',
        amount: 10.0,
        description: 'Referrer bonus: $10',
        isActive: true,
      },
      {
        rewardType: RewardType.BALANCE_CREDIT,
        recipientType: 'REFEREE',
        amount: 5.0,
        description: 'Referee bonus: $5',
        isActive: true,
      },
    ]);
  });

  describe('POST /referral', () => {
    it('should create a new referral', () => {
      return request(app.getHttpServer())
        .post('/referral')
        .send({
          referrerId: 1,
          refereeId: 2,
          referralCode: 'TEST123',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.referral).toBeDefined();
          expect(res.body.referral.referrerId).toBe(1);
          expect(res.body.referral.refereeId).toBe(2);
          expect(res.body.referral.status).toBe('PENDING');
        });
    });

    it('should reject duplicate referee', async () => {
      await referralRepo.save({
        referrerId: 1,
        refereeId: 2,
        referralCode: 'EXISTING',
        status: ReferralStatus.PENDING,
      });

      return request(app.getHttpServer())
        .post('/referral')
        .send({
          referrerId: 3,
          refereeId: 2,
          referralCode: 'DUPLICATE',
        })
        .expect(400);
    });
  });

  describe('POST /referral/verify', () => {
    beforeEach(async () => {
      await referralRepo.save({
        referrerId: 1,
        refereeId: 2,
        referralCode: 'VERIFY123',
        status: ReferralStatus.PENDING,
      });
    });

    it('should verify referral and distribute rewards', () => {
      return request(app.getHttpServer())
        .post('/referral/verify')
        .send({ refereeId: 2 })
        .expect(201)
        .expect((res) => {
          expect(res.body.referral).toBeDefined();
          expect(res.body.referral.status).toBe('VERIFIED');
          expect(res.body.referral.verifiedAt).toBeDefined();
          expect(res.body.distributions).toBeDefined();
        });
    });

    it('should reject verification for non-existent referral', () => {
      return request(app.getHttpServer())
        .post('/referral/verify')
        .send({ refereeId: 999 })
        .expect(400);
    });

    it('should reject double verification', async () => {
      // First verification
      await request(app.getHttpServer())
        .post('/referral/verify')
        .send({ refereeId: 2 });

      // Second verification should fail
      return request(app.getHttpServer())
        .post('/referral/verify')
        .send({ refereeId: 2 })
        .expect(400);
    });
  });

  describe('GET /referral/referee/:refereeId', () => {
    beforeEach(async () => {
      await referralRepo.save({
        referrerId: 1,
        refereeId: 2,
        referralCode: 'GET123',
        status: ReferralStatus.PENDING,
      });
    });

    it('should get referral by referee ID', () => {
      return request(app.getHttpServer())
        .get('/referral/referee/2')
        .expect(200)
        .expect((res) => {
          expect(res.body.referral).toBeDefined();
          expect(res.body.referral.refereeId).toBe(2);
        });
    });

    it('should return null for non-existent referral', () => {
      return request(app.getHttpServer())
        .get('/referral/referee/999')
        .expect(200)
        .expect((res) => {
          expect(res.body.referral).toBeNull();
        });
    });
  });

  describe('GET /referral/referrer/:referrerId', () => {
    beforeEach(async () => {
      await referralRepo.save([
        {
          referrerId: 1,
          refereeId: 2,
          referralCode: 'REF1',
          status: ReferralStatus.PENDING,
        },
        {
          referrerId: 1,
          refereeId: 3,
          referralCode: 'REF2',
          status: ReferralStatus.PENDING,
        },
      ]);

      // Create user 3
      await userRepo.save({
        id: 3,
        username: 'referee2',
        email: 'referee2@test.com',
        role: 'USER',
      });
    });

    it('should get all referrals for a referrer', () => {
      return request(app.getHttpServer())
        .get('/referral/referrer/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.referrals).toBeDefined();
          expect(res.body.referrals.length).toBe(2);
        });
    });
  });

  describe('GET /referral/config', () => {
    it('should get all reward configurations', () => {
      return request(app.getHttpServer())
        .get('/referral/config')
        .expect(200)
        .expect((res) => {
          expect(res.body.configs).toBeDefined();
          expect(res.body.configs.length).toBeGreaterThan(0);
        });
    });
  });

  describe('Reward Distribution Integration', () => {
    it('should credit balance to both referrer and referee', async () => {
      // Create referral
      await referralRepo.save({
        referrerId: 1,
        refereeId: 2,
        referralCode: 'REWARD123',
        status: ReferralStatus.PENDING,
      });

      // Verify and distribute rewards
      const response = await request(app.getHttpServer())
        .post('/referral/verify')
        .send({ refereeId: 2 })
        .expect(201);

      expect(response.body.distributions).toBeDefined();
      expect(response.body.distributions.length).toBeGreaterThan(0);

      // Check balances were credited
      const referrerBalance = await balanceRepo.findOne({
        where: { userId: 1 },
      });
      const refereeBalance = await balanceRepo.findOne({
        where: { userId: 2 },
      });

      expect(referrerBalance).toBeDefined();
      expect(refereeBalance).toBeDefined();
      expect(Number(referrerBalance.balance)).toBeGreaterThanOrEqual(10);
      expect(Number(refereeBalance.balance)).toBeGreaterThanOrEqual(5);
    });
  });
});
