import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AmmService } from './services/amm.service';
import { LiquidityPoolService } from './services/liquidity-pool.service';
import { PoolAnalyticsService } from './services/pool-analytics.service';
import { LiquidityPool } from './entities/liquidity-pool.entity';
import { PoolPosition } from './entities/pool-position.entity';
import { PoolSwap } from './entities/pool-swap.entity';
import { EmergencyWithdrawal } from './entities/emergency-withdrawal.entity';
import { VirtualAsset } from '../database/entities/virtual-asset.entity';
import { PoolStatus } from './enums/pool-status.enum';

/**
 * Integration test exercising the full liquidity pool lifecycle:
 * create pool → add liquidity → swap → fee distribution → IL calculation → remove liquidity → emergency withdraw
 */
describe('Liquidity Pool Integration', () => {
  let ammService: AmmService;
  let poolService: LiquidityPoolService;
  let analyticsService: PoolAnalyticsService;

  const tokenA = { id: 1, symbol: 'BTC', name: 'Bitcoin', price: 50000 };
  const tokenB = { id: 2, symbol: 'ETH', name: 'Ethereum', price: 3000 };

  let poolState: Record<string, unknown>;
  let positionState: Record<string, unknown> | null;
  const swaps: Record<string, unknown>[] = [];

  beforeEach(async () => {
    poolState = {
      id: 1,
      tokenAId: 1,
      tokenBId: 2,
      chainId: 'stellar',
      reserveA: 0,
      reserveB: 0,
      totalLpSupply: 0,
      feeBps: 30,
      status: PoolStatus.ACTIVE,
      accumulatedFeesA: 0,
      accumulatedFeesB: 0,
      totalVolume: 0,
      totalSwaps: 0,
      tokenA,
      tokenB,
    };
    positionState = null;
    swaps.length = 0;

    const mockPoolRepo = {
      findOne: jest.fn(async (opts) => {
        const where = opts?.where ?? {};
        if (where.id === poolState.id) return { ...poolState };
        if (
          where.tokenAId === poolState.tokenAId &&
          where.tokenBId === poolState.tokenBId &&
          where.chainId === poolState.chainId
        ) {
          return poolState.totalLpSupply === 0 ? null : { ...poolState };
        }
        if (
          where.tokenAId === poolState.tokenBId &&
          where.tokenBId === poolState.tokenAId &&
          where.chainId === poolState.chainId
        ) {
          return null;
        }
        return null;
      }),
      find: jest.fn(async () => [{ ...poolState }]),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => {
        poolState = { ...poolState, ...data };
        return { ...poolState };
      }),
    };

    const mockPositionRepo = {
      findOne: jest.fn(async (opts) => {
        const where = opts?.where ?? {};
        if (where.id && positionState) {
          return { ...positionState, pool: { ...poolState, tokenA, tokenB } };
        }
        if (
          positionState &&
          where.poolId === positionState.poolId &&
          where.userId === positionState.userId
        ) {
          return { ...positionState };
        }
        return null;
      }),
      find: jest.fn(async () => (positionState ? [{ ...positionState }] : [])),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => {
        positionState = { ...data, id: 1 };
        return { ...positionState };
      }),
    };

    const mockSwapRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => {
        const swap = { ...data, id: `swap-${swaps.length + 1}` };
        swaps.push(swap);
        return swap;
      }),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => swaps),
      })),
    };

    const mockEmergencyRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ ...data, id: 1 })),
    };

    const mockAssetRepo = {
      findOne: jest.fn(async ({ where }) => {
        if (where.id === 1) return tokenA;
        if (where.id === 2) return tokenB;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmmService,
        LiquidityPoolService,
        PoolAnalyticsService,
        { provide: getRepositoryToken(LiquidityPool), useValue: mockPoolRepo },
        {
          provide: getRepositoryToken(PoolPosition),
          useValue: mockPositionRepo,
        },
        { provide: getRepositoryToken(PoolSwap), useValue: mockSwapRepo },
        {
          provide: getRepositoryToken(EmergencyWithdrawal),
          useValue: mockEmergencyRepo,
        },
        { provide: getRepositoryToken(VirtualAsset), useValue: mockAssetRepo },
      ],
    }).compile();

    ammService = module.get(AmmService);
    poolService = module.get(LiquidityPoolService);
    analyticsService = module.get(PoolAnalyticsService);
  });

  it('should complete full liquidity pool lifecycle', async () => {
    const pool = await poolService.createPool({
      tokenAId: 1,
      tokenBId: 2,
      chainId: 'stellar',
      feeBps: 30,
    });
    expect(pool.chainId).toBe('stellar');

    const addResult = await poolService.addLiquidity(1, {
      userId: 1,
      amountA: 1000,
      amountB: 2000,
    });
    expect(addResult.lpTokensMinted).toBeGreaterThan(0);
    expect(Number(addResult.pool.reserveA)).toBe(1000);
    expect(Number(addResult.pool.reserveB)).toBe(2000);

    const swapResult = await poolService.swap(1, {
      userId: 2,
      tokenIn: 'BTC',
      amountIn: 100,
    });
    expect(swapResult.swap.amountOut).toBeGreaterThan(0);
    expect(swapResult.pool.totalSwaps).toBe(1);

    const metrics = await analyticsService.getPoolMetrics(1);
    expect(metrics.tvl).toBeGreaterThan(0);
    expect(metrics.spotPrice).toBeGreaterThan(0);

    const il = await analyticsService.getImpermanentLoss(1);
    expect(il.currentValue).toBeGreaterThan(0);

    const removeResult = await poolService.removeLiquidity(1, {
      userId: 1,
      lpAmount: addResult.lpTokensMinted / 2,
    });
    expect(removeResult.amounts.amountA).toBeGreaterThan(0);
    expect(removeResult.amounts.amountB).toBeGreaterThan(0);

    const emergency = await poolService.emergencyWithdraw(1, {
      userId: 1,
      lpAmount: removeResult.position.lpAmount,
      reason: 'Emergency test',
      adminApprovedBy: 99,
    });
    expect(emergency.lpAmountBurned).toBeGreaterThan(0);

    const dashboard = await analyticsService.getAnalyticsDashboard();
    expect(dashboard.totalPools).toBe(1);
    expect(dashboard.pools.length).toBe(1);
  });

  it('should find pool for asset pair', async () => {
    poolState = {
      ...poolState,
      reserveA: 1000,
      reserveB: 2000,
      totalLpSupply: 1000,
    };

    const found = await poolService.findPoolForPair(1, 2, 'stellar');
    expect(found).not.toBeNull();
    expect(found!.chainId).toBe('stellar');
  });
});
