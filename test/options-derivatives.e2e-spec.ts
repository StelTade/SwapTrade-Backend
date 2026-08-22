import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { OptionContract } from '../src/options-derivatives/entities/option-contract.entity';
import { OptionPosition } from '../src/options-derivatives/entities/option-position.entity';
import { OptionCollateral } from '../src/options-derivatives/entities/option-collateral.entity';
import { VolatilitySurface } from '../src/options-derivatives/entities/volatility-surface.entity';
import { VirtualAsset } from '../src/database/entities/virtual-asset.entity';
import { UserBalance } from '../src/database/entities/user-balance.entity';
import { OptionsDerivativesModule } from '../src/options-derivatives/options-derivatives.module';
import { OptionType } from '../src/options-derivatives/enums/option-type.enum';
import { ExerciseStyle } from '../src/options-derivatives/enums/exercise-style.enum';
import { Repository } from 'typeorm';

describe('Options & Derivatives (e2e)', () => {
  let app: INestApplication;
  let contractRepo: Repository<OptionContract>;
  let positionRepo: Repository<OptionPosition>;
  let collateralRepo: Repository<OptionCollateral>;
  let surfaceRepo: Repository<VolatilitySurface>;
  let assetRepo: Repository<VirtualAsset>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            OptionContract,
            OptionPosition,
            OptionCollateral,
            VolatilitySurface,
            VirtualAsset,
            UserBalance,
          ],
          synchronize: true,
        }),
        OptionsDerivativesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    contractRepo = moduleFixture.get(getRepositoryToken(OptionContract));
    positionRepo = moduleFixture.get(getRepositoryToken(OptionPosition));
    collateralRepo = moduleFixture.get(getRepositoryToken(OptionCollateral));
    surfaceRepo = moduleFixture.get(getRepositoryToken(VolatilitySurface));
    assetRepo = moduleFixture.get(getRepositoryToken(VirtualAsset));

    // Seed a BTC asset
    await assetRepo.save({
      symbol: 'BTC',
      name: 'Bitcoin',
      price: 50000,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Option Lifecycle', () => {
    let contractId: number;

    it('Step 1: Create a call option contract', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 3);

      const response = await request(app.getHttpServer())
        .post('/options/contracts')
        .send({
          optionType: OptionType.CALL,
          underlyingAssetId: 1,
          strikePrice: 55000,
          contractSize: 1,
          expirationDate: futureDate.toISOString(),
          impliedVolatility: 0.3,
          riskFreeRate: 0.05,
          totalSupply: 100,
          exerciseStyle: ExerciseStyle.EUROPEAN,
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.optionType).toBe('CALL');
      expect(response.body.strikePrice).toBe(55000);
      expect(response.body.premium).toBeGreaterThan(0);
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.totalSupply).toBe(100);
      expect(response.body.openInterest).toBe(100);

      contractId = response.body.id;
    });

    it('Step 2: Get the created contract', async () => {
      const response = await request(app.getHttpServer())
        .get(`/options/contracts/${contractId}`)
        .expect(200);

      expect(response.body.id).toBe(contractId);
      expect(response.body.underlyingAsset.symbol).toBe('BTC');
    });

    it('Step 3: List all contracts', async () => {
      const response = await request(app.getHttpServer())
        .get('/options/contracts')
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('Step 4: List contracts filtered by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/options/contracts?optionType=CALL')
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body.every((c: any) => c.optionType === 'CALL')).toBe(true);
    });

    it('Step 5: Recalculate price with new underlying', async () => {
      const response = await request(app.getHttpServer())
        .post(`/options/contracts/${contractId}/recalculate`)
        .send({ currentPrice: 60000 })
        .expect(201);

      expect(response.body.premium).toBeGreaterThan(0);
      expect(response.body.inTheMoney).toBe(true); // 60000 > 55000
    });

    it('Step 6: Buyer purchases option', async () => {
      const response = await request(app.getHttpServer())
        .post('/options/positions/buy')
        .send({
          contractId,
          userId: 1,
          quantity: 10,
        })
        .expect(201);

      expect(response.body.quantity).toBe(10);
      expect(response.body.isWriter).toBe(false);
      expect(response.body.totalPremium).toBeGreaterThan(0);
    });

    it('Step 7: Writer writes option', async () => {
      const response = await request(app.getHttpServer())
        .post('/options/positions/buy')
        .send({
          contractId,
          userId: 2,
          quantity: 10,
        })
        .expect(201);

      expect(response.body.quantity).toBe(10);
      expect(response.body.isWriter).toBe(true);
      expect(response.body.totalPremium).toBeGreaterThan(0);
    });

    it('Step 8: Lock collateral for writer', async () => {
      const response = await request(app.getHttpServer())
        .post('/options/collateral/lock')
        .send({
          userId: 2,
          contractId,
          quantity: 10,
          collateralAssetId: 1,
        })
        .expect(201);

      expect(response.body.lockedAmount).toBeGreaterThan(0);
      expect(response.body.coveredContracts).toBe(10);
      expect(response.body.status).toBe('LOCKED');
    });

    it('Step 9: Get user positions', async () => {
      const response = await request(app.getHttpServer())
        .get('/options/positions/user/1')
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('Step 10: Get user portfolio summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/options/positions/user/1/portfolio')
        .expect(200);

      expect(response.body.totalPositions).toBeGreaterThanOrEqual(1);
      expect(response.body.totalHolderPositions).toBeGreaterThanOrEqual(1);
    });

    it('Step 11: Exercise the option (ITM)', async () => {
      const response = await request(app.getHttpServer())
        .post('/options/exercise')
        .send({
          contractId,
          userId: 1,
          quantity: 5,
          currentPrice: 60000,
        })
        .expect(201);

      expect(response.body.settlementAmount).toBeGreaterThan(0);
      expect(response.body.pnl).toBeDefined();
      expect(response.body.quantity).toBe(5);
    });

    it('Step 12: Check remaining open interest', async () => {
      const response = await request(app.getHttpServer())
        .get(`/options/contracts/${contractId}`)
        .expect(200);

      expect(Number(response.body.openInterest)).toBeLessThan(100);
    });

    it('Step 13: Update unrealized PnL', async () => {
      // Get position ID first
      const posResponse = await request(app.getHttpServer())
        .get('/options/positions/user/1')
        .expect(200);

      if (posResponse.body.length > 0) {
        const positionId = posResponse.body[0].id;
        const response = await request(app.getHttpServer())
          .post(`/options/positions/${positionId}/update-pnl`)
          .send({ currentPrice: 62000 })
          .expect(201);

        expect(response.body.unrealizedPnl).toBeDefined();
      }
    });

    it('Step 14: Calculate Black-Scholes price directly', async () => {
      const response = await request(app.getHttpServer())
        .post('/options/pricing/black-scholes')
        .send({
          spotPrice: 50000,
          strikePrice: 55000,
          timeToExpiry: 0.25,
          riskFreeRate: 0.05,
          volatility: 0.3,
          optionType: OptionType.CALL,
        })
        .expect(201);

      expect(response.body.price).toBeGreaterThan(0);
      expect(response.body.delta).toBeDefined();
      expect(response.body.gamma).toBeDefined();
      expect(response.body.vega).toBeDefined();
      expect(response.body.theta).toBeDefined();
    });

    it('Step 15: Create a put option and exercise OTM (zero settlement)', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      const createResponse = await request(app.getHttpServer())
        .post('/options/contracts')
        .send({
          optionType: OptionType.PUT,
          underlyingAssetId: 1,
          strikePrice: 45000,
          contractSize: 1,
          expirationDate: futureDate.toISOString(),
          impliedVolatility: 0.3,
          totalSupply: 50,
        })
        .expect(201);

      const putContractId = createResponse.body.id;

      // Buy the put
      await request(app.getHttpServer())
        .post('/options/positions/buy')
        .send({ contractId: putContractId, userId: 3, quantity: 5 })
        .expect(201);

      // Exercise OTM (price 50000 > strike 45000, put has no value)
      const exerciseResponse = await request(app.getHttpServer())
        .post('/options/exercise')
        .send({
          contractId: putContractId,
          userId: 3,
          quantity: 5,
          currentPrice: 50000,
        })
        .expect(201);

      expect(exerciseResponse.body.settlementAmount).toBe(0); // OTM
    });
  });

  describe('Volatility Surface', () => {
    it('should update and retrieve volatility surface', async () => {
      // Update
      await request(app.getHttpServer())
        .post('/options/volatility/update')
        .send({
          assetId: 1,
          strikePrice: 50000,
          expirationDate: new Date('2026-12-31').toISOString(),
          impliedVolatility: 0.35,
          bidIv: 0.33,
          askIv: 0.37,
        })
        .expect(201);

      // Get surface
      const surfaceResponse = await request(app.getHttpServer())
        .get('/options/volatility/surface/1')
        .expect(200);

      expect(surfaceResponse.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should interpolate volatility', async () => {
      const response = await request(app.getHttpServer())
        .get('/options/volatility/interpolate?assetId=1&strikePrice=50000&expirationDate=2026-12-31')
        .expect(200);

      expect(response.body.impliedVolatility).toBeGreaterThan(0);
    });
  });

  describe('Collateral Validation', () => {
    let collateralContractId: number;

    it('should lock and validate collateral', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);

      const createResponse = await request(app.getHttpServer())
        .post('/options/contracts')
        .send({
          optionType: OptionType.PUT,
          underlyingAssetId: 1,
          strikePrice: 48000,
          contractSize: 1,
          expirationDate: futureDate.toISOString(),
          totalSupply: 10,
        })
        .expect(201);

      collateralContractId = createResponse.body.id;

      // Lock collateral
      await request(app.getHttpServer())
        .post('/options/collateral/lock')
        .send({
          userId: 5,
          contractId: collateralContractId,
          quantity: 10,
          collateralAssetId: 1,
        })
        .expect(201);

      // Validate coverage
      const validationResponse = await request(app.getHttpServer())
        .get(`/options/collateral/contract/${collateralContractId}/validation`)
        .expect(200);

      expect(validationResponse.body.covered).toBeDefined();
      expect(validationResponse.body.totalCollateral).toBeGreaterThan(0);
    });
  });

  describe('Contract Expiration', () => {
    it('should expire outdated contracts', async () => {
      const response = await request(app.getHttpServer())
        .post('/options/expire-contracts')
        .expect(201);

      expect(typeof response.body).toBe('number');
    });
  });
});
