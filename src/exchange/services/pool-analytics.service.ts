import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiquidityPool } from '../entities/liquidity-pool.entity';
import { PoolSwap } from '../entities/pool-swap.entity';
import { PoolPosition } from '../entities/pool-position.entity';
import { AmmService } from './amm.service';
import { LiquidityPoolService } from './liquidity-pool.service';

export interface PoolMetrics {
  poolId: number;
  chainId: string;
  tokenA: string;
  tokenB: string;
  reserveA: number;
  reserveB: number;
  totalLpSupply: number;
  tvl: number;
  spotPrice: number;
  feeBps: number;
  status: string;
  totalVolume: number;
  totalSwaps: number;
  accumulatedFeesA: number;
  accumulatedFeesB: number;
  healthRatio: number;
}

export interface PoolAnalyticsDashboard {
  totalPools: number;
  activePools: number;
  totalTvl: number;
  totalVolume24h: number;
  totalSwaps24h: number;
  pools: PoolMetrics[];
}

@Injectable()
export class PoolAnalyticsService {
  constructor(
    @InjectRepository(LiquidityPool)
    private readonly poolRepo: Repository<LiquidityPool>,
    @InjectRepository(PoolSwap)
    private readonly swapRepo: Repository<PoolSwap>,
    @InjectRepository(PoolPosition)
    private readonly positionRepo: Repository<PoolPosition>,
    private readonly ammService: AmmService,
    private readonly poolService: LiquidityPoolService,
  ) {}

  async getPoolMetrics(poolId: number): Promise<PoolMetrics> {
    const pool = await this.poolService.getPool(poolId);
    const reserveA = Number(pool.reserveA);
    const reserveB = Number(pool.reserveB);

    return {
      poolId: pool.id,
      chainId: pool.chainId,
      tokenA: pool.tokenA?.symbol ?? '',
      tokenB: pool.tokenB?.symbol ?? '',
      reserveA,
      reserveB,
      totalLpSupply: Number(pool.totalLpSupply),
      tvl: reserveA + reserveB,
      spotPrice: this.ammService.getSpotPrice(reserveA, reserveB),
      feeBps: pool.feeBps,
      status: pool.status,
      totalVolume: Number(pool.totalVolume),
      totalSwaps: pool.totalSwaps,
      accumulatedFeesA: Number(pool.accumulatedFeesA),
      accumulatedFeesB: Number(pool.accumulatedFeesB),
      healthRatio: this.calculateHealthRatio(reserveA, reserveB),
    };
  }

  async getAnalyticsDashboard(): Promise<PoolAnalyticsDashboard> {
    const pools = await this.poolRepo.find({ relations: ['tokenA', 'tokenB'] });
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentSwaps = await this.swapRepo
      .createQueryBuilder('swap')
      .where('swap.createdAt >= :since', { since: since24h })
      .getMany();

    const poolMetrics = pools.map((pool) => {
      const reserveA = Number(pool.reserveA);
      const reserveB = Number(pool.reserveB);
      return {
        poolId: pool.id,
        chainId: pool.chainId,
        tokenA: pool.tokenA?.symbol ?? '',
        tokenB: pool.tokenB?.symbol ?? '',
        reserveA,
        reserveB,
        totalLpSupply: Number(pool.totalLpSupply),
        tvl: reserveA + reserveB,
        spotPrice: this.ammService.getSpotPrice(reserveA, reserveB),
        feeBps: pool.feeBps,
        status: pool.status,
        totalVolume: Number(pool.totalVolume),
        totalSwaps: pool.totalSwaps,
        accumulatedFeesA: Number(pool.accumulatedFeesA),
        accumulatedFeesB: Number(pool.accumulatedFeesB),
        healthRatio: this.calculateHealthRatio(reserveA, reserveB),
      };
    });

    return {
      totalPools: pools.length,
      activePools: pools.filter((p) => p.status === 'ACTIVE').length,
      totalTvl: poolMetrics.reduce((sum, p) => sum + p.tvl, 0),
      totalVolume24h: recentSwaps.reduce(
        (sum, s) => sum + Number(s.amountIn),
        0,
      ),
      totalSwaps24h: recentSwaps.length,
      pools: poolMetrics,
    };
  }

  async getImpermanentLoss(positionId: number) {
    const position = await this.poolService.getPosition(positionId);
    const pool = position.pool;

    return this.ammService.calculateImpermanentLoss(
      Number(position.depositedAmountA),
      Number(position.depositedAmountB),
      Number(pool.reserveA),
      Number(pool.reserveB),
      Number(pool.totalLpSupply),
      Number(position.lpAmount),
    );
  }

  private calculateHealthRatio(reserveA: number, reserveB: number): number {
    if (reserveA <= 0 || reserveB <= 0) return 0;
    const ratio = reserveA / reserveB;
    return Math.min(ratio, 1 / ratio);
  }
}
