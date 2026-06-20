import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LiquidityPoolService } from './liquidity-pool.service';
import { AmmService } from './amm.service';
import { LiquidityPool } from '../entities/liquidity-pool.entity';
import { PoolPosition } from '../entities/pool-position.entity';
import { PoolSwap } from '../entities/pool-swap.entity';
import { EmergencyWithdrawal } from '../entities/emergency-withdrawal.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { PoolStatus } from '../enums/pool-status.enum';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ ...data, id: data.id ?? 1 })),
  createQueryBuilder: jest.fn(),
});

describe('LiquidityPoolService', () => {
  let service: LiquidityPoolService;
  let poolRepo: ReturnType<typeof mockRepo>;
  let positionRepo: ReturnType<typeof mockRepo>;
  let swapRepo: ReturnType<typeof mockRepo>;
  let emergencyRepo: ReturnType<typeof mockRepo>;
  let assetRepo: ReturnType<typeof mockRepo>;

  const tokenA = { id: 1, symbol: 'BTC', name: 'Bitcoin', price: 50000 };
  const tokenB = { id: 2, symbol: 'ETH', name: 'Ethereum', price: 3000 };

  const makePool = (overrides = {}): Partial<LiquidityPool> => ({
    id: 1,
    tokenAId: 1,
    tokenBId: 2,
    chainId: 'stellar',
    reserveA: 1000,
    reserveB: 2000,
    totalLpSupply: 1000,
    feeBps: 30,
    status: PoolStatus.ACTIVE,
    accumulatedFeesA: 0,
    accumulatedFeesB: 0,
    totalVolume: 0,
    totalSwaps: 0,
    tokenA: tokenA as VirtualAsset,
    tokenB: tokenB as VirtualAsset,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityPoolService,
        AmmService,
        { provide: getRepositoryToken(LiquidityPool), useFactory: mockRepo },
        { provide: getRepositoryToken(PoolPosition), useFactory: mockRepo },
        { provide: getRepositoryToken(PoolSwap), useFactory: mockRepo },
        {
          provide: getRepositoryToken(EmergencyWithdrawal),
          useFactory: mockRepo,
        },
        { provide: getRepositoryToken(VirtualAsset), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(LiquidityPoolService);
    poolRepo = module.get(getRepositoryToken(LiquidityPool));
    positionRepo = module.get(getRepositoryToken(PoolPosition));
    swapRepo = module.get(getRepositoryToken(PoolSwap));
    emergencyRepo = module.get(getRepositoryToken(EmergencyWithdrawal));
    assetRepo = module.get(getRepositoryToken(VirtualAsset));
  });

  describe('createPool', () => {
    it('should create a new liquidity pool', async () => {
      assetRepo.findOne.mockImplementation(({ where }) => {
        if (where.id === 1) return tokenA;
        if (where.id === 2) return tokenB;
        return null;
      });
      poolRepo.findOne.mockResolvedValue(null);
      poolRepo.save.mockImplementation((pool) => ({ ...pool, id: 1 }));

      const result = await service.createPool({
        tokenAId: 1,
        tokenBId: 2,
        chainId: 'stellar',
        feeBps: 30,
      });

      expect(result.chainId).toBe('stellar');
      expect(result.feeBps).toBe(30);
      expect(poolRepo.save).toHaveBeenCalled();
    });
  });

  describe('addLiquidity', () => {
    it('should add liquidity and mint LP tokens', async () => {
      const pool = makePool({ reserveA: 0, reserveB: 0, totalLpSupply: 0 });
      poolRepo.findOne.mockResolvedValue(pool);
      positionRepo.findOne.mockResolvedValue(null);
      poolRepo.save.mockImplementation((p) => p);
      positionRepo.save.mockImplementation((p) => ({ ...p, id: 1 }));

      const result = await service.addLiquidity(1, {
        userId: 1,
        amountA: 100,
        amountB: 100,
      });

      expect(result.lpTokensMinted).toBe(100);
      expect(result.pool.reserveA).toBe(100);
      expect(result.pool.reserveB).toBe(100);
    });
  });

  describe('swap', () => {
    it('should execute swap against pool reserves', async () => {
      const pool = makePool();
      poolRepo.findOne.mockResolvedValue(pool);
      positionRepo.find.mockResolvedValue([]);
      poolRepo.save.mockImplementation((p) => p);
      swapRepo.save.mockImplementation((s) => ({ ...s, id: 'swap-1' }));

      const result = await service.swap(1, {
        userId: 1,
        tokenIn: 'BTC',
        amountIn: 10,
      });

      expect(result.swap.amountIn).toBe(10);
      expect(result.swap.amountOut).toBeGreaterThan(0);
      expect(result.pool.totalSwaps).toBe(1);
    });
  });

  describe('findPoolForPair', () => {
    it('should find pool for asset pair', async () => {
      const pool = makePool();
      poolRepo.findOne.mockResolvedValue(pool);

      const result = await service.findPoolForPair(1, 2, 'stellar');
      expect(result).toBe(pool);
    });
  });

  describe('emergencyWithdraw', () => {
    it('should process emergency withdrawal', async () => {
      const pool = makePool();
      const position = {
        id: 1,
        poolId: 1,
        userId: 1,
        lpAmount: 500,
        depositedAmountA: 500,
        depositedAmountB: 1000,
      };

      poolRepo.findOne.mockResolvedValue(pool);
      positionRepo.findOne.mockResolvedValue(position);
      poolRepo.save.mockImplementation((p) => p);
      positionRepo.save.mockImplementation((p) => p);
      emergencyRepo.save.mockImplementation((w) => ({ ...w, id: 1 }));

      const result = await service.emergencyWithdraw(1, {
        userId: 1,
        lpAmount: 100,
        reason: 'Pool exploit detected',
        adminApprovedBy: 99,
      });

      expect(result.lpAmountBurned).toBe(100);
      expect(result.reason).toBe('Pool exploit detected');
    });
  });
});
