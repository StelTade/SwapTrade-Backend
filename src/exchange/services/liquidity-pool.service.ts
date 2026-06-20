import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiquidityPool } from '../entities/liquidity-pool.entity';
import { PoolPosition } from '../entities/pool-position.entity';
import { PoolSwap } from '../entities/pool-swap.entity';
import { EmergencyWithdrawal } from '../entities/emergency-withdrawal.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { AmmService } from './amm.service';
import { PoolStatus } from '../enums/pool-status.enum';
import { EmergencyWithdrawalStatus } from '../enums/emergency-withdrawal-status.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreatePoolDto } from '../dto/create-pool.dto';
import { AddLiquidityDto } from '../dto/add-liquidity.dto';
import { RemoveLiquidityDto } from '../dto/remove-liquidity.dto';
import { SwapDto } from '../dto/swap.dto';
import { EmergencyWithdrawDto } from '../dto/emergency-withdraw.dto';

@Injectable()
export class LiquidityPoolService {
  constructor(
    @InjectRepository(LiquidityPool)
    private readonly poolRepo: Repository<LiquidityPool>,
    @InjectRepository(PoolPosition)
    private readonly positionRepo: Repository<PoolPosition>,
    @InjectRepository(PoolSwap)
    private readonly swapRepo: Repository<PoolSwap>,
    @InjectRepository(EmergencyWithdrawal)
    private readonly emergencyRepo: Repository<EmergencyWithdrawal>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
    private readonly ammService: AmmService,
  ) {}

  async createPool(dto: CreatePoolDto): Promise<LiquidityPool> {
    if (dto.tokenAId === dto.tokenBId) {
      throw new BadRequestException('Token A and Token B must be different');
    }

    const tokenA = await this.assetRepo.findOne({
      where: { id: dto.tokenAId },
    });
    const tokenB = await this.assetRepo.findOne({
      where: { id: dto.tokenBId },
    });
    if (!tokenA || !tokenB) {
      throw new NotFoundException('One or both assets not found');
    }

    const existing = await this.poolRepo.findOne({
      where: {
        tokenAId: dto.tokenAId,
        tokenBId: dto.tokenBId,
        chainId: dto.chainId,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Pool already exists for this pair on this chain',
      );
    }

    const pool = this.poolRepo.create({
      tokenAId: dto.tokenAId,
      tokenBId: dto.tokenBId,
      chainId: dto.chainId,
      feeBps: dto.feeBps ?? 30,
      status: PoolStatus.ACTIVE,
      reserveA: 0,
      reserveB: 0,
      totalLpSupply: 0,
    });

    return this.poolRepo.save(pool);
  }

  async getPool(poolId: number): Promise<LiquidityPool> {
    const pool = await this.poolRepo.findOne({
      where: { id: poolId },
      relations: ['tokenA', 'tokenB'],
    });
    if (!pool) {
      throw new NotFoundException(`Pool ${poolId} not found`);
    }
    return pool;
  }

  async listPools(chainId?: string): Promise<LiquidityPool[]> {
    const where = chainId ? { chainId } : {};
    return this.poolRepo.find({
      where,
      relations: ['tokenA', 'tokenB'],
      order: { createdAt: 'DESC' },
    });
  }

  async findPoolForPair(
    tokenAId: number,
    tokenBId: number,
    chainId?: string,
  ): Promise<LiquidityPool | null> {
    const where: Record<string, unknown> = {
      tokenAId,
      tokenBId,
      status: PoolStatus.ACTIVE,
    };
    if (chainId) where.chainId = chainId;

    let pool = await this.poolRepo.findOne({
      where,
      relations: ['tokenA', 'tokenB'],
    });
    if (!pool) {
      pool = await this.poolRepo.findOne({
        where: {
          tokenAId: tokenBId,
          tokenBId: tokenAId,
          status: PoolStatus.ACTIVE,
          ...(chainId ? { chainId } : {}),
        },
        relations: ['tokenA', 'tokenB'],
      });
    }
    return pool;
  }

  async addLiquidity(
    poolId: number,
    dto: AddLiquidityDto,
  ): Promise<{
    pool: LiquidityPool;
    position: PoolPosition;
    lpTokensMinted: number;
  }> {
    const pool = await this.getPool(poolId);

    if (pool.status !== PoolStatus.ACTIVE) {
      throw new BadRequestException('Pool is not active');
    }

    const quote = this.ammService.calculateLpTokensToMint(
      dto.amountA,
      dto.amountB,
      Number(pool.reserveA),
      Number(pool.reserveB),
      Number(pool.totalLpSupply),
    );

    pool.reserveA = Number(pool.reserveA) + quote.amountA;
    pool.reserveB = Number(pool.reserveB) + quote.amountB;
    pool.totalLpSupply = Number(pool.totalLpSupply) + quote.lpTokensMinted;

    let position = await this.positionRepo.findOne({
      where: { poolId, userId: dto.userId },
    });

    if (position) {
      position.lpAmount = Number(position.lpAmount) + quote.lpTokensMinted;
      position.depositedAmountA =
        Number(position.depositedAmountA) + quote.amountA;
      position.depositedAmountB =
        Number(position.depositedAmountB) + quote.amountB;
    } else {
      position = this.positionRepo.create({
        poolId,
        userId: dto.userId,
        lpAmount: quote.lpTokensMinted,
        depositedAmountA: quote.amountA,
        depositedAmountB: quote.amountB,
        depositedAt: new Date(),
      });
    }

    const savedPool = await this.poolRepo.save(pool);
    const savedPosition = await this.positionRepo.save(position);

    return {
      pool: savedPool,
      position: savedPosition,
      lpTokensMinted: quote.lpTokensMinted,
    };
  }

  async removeLiquidity(
    poolId: number,
    dto: RemoveLiquidityDto,
  ): Promise<{
    pool: LiquidityPool;
    position: PoolPosition;
    amounts: { amountA: number; amountB: number };
  }> {
    const pool = await this.getPool(poolId);

    if (pool.status === PoolStatus.EMERGENCY) {
      throw new BadRequestException(
        'Use emergency withdrawal for pools in emergency status',
      );
    }

    const position = await this.positionRepo.findOne({
      where: { poolId, userId: dto.userId },
    });
    if (!position || Number(position.lpAmount) < dto.lpAmount) {
      throw new BadRequestException('Insufficient LP tokens');
    }

    const amounts = this.ammService.calculateWithdrawAmounts(
      dto.lpAmount,
      Number(pool.totalLpSupply),
      Number(pool.reserveA),
      Number(pool.reserveB),
    );

    pool.reserveA = Number(pool.reserveA) - amounts.amountA;
    pool.reserveB = Number(pool.reserveB) - amounts.amountB;
    pool.totalLpSupply = Number(pool.totalLpSupply) - dto.lpAmount;

    position.lpAmount = Number(position.lpAmount) - dto.lpAmount;
    const depositShare =
      dto.lpAmount / (Number(position.lpAmount) + dto.lpAmount);
    position.depositedAmountA =
      Number(position.depositedAmountA) * (1 - depositShare);
    position.depositedAmountB =
      Number(position.depositedAmountB) * (1 - depositShare);

    const savedPool = await this.poolRepo.save(pool);
    const savedPosition = await this.positionRepo.save(position);

    return { pool: savedPool, position: savedPosition, amounts };
  }

  async swap(
    poolId: number,
    dto: SwapDto,
  ): Promise<{ swap: PoolSwap; pool: LiquidityPool }> {
    const pool = await this.getPool(poolId);

    if (pool.status !== PoolStatus.ACTIVE) {
      throw new BadRequestException('Pool is not active for trading');
    }

    const tokenA =
      pool.tokenA ??
      (await this.assetRepo.findOne({ where: { id: pool.tokenAId } }));
    const tokenB =
      pool.tokenB ??
      (await this.assetRepo.findOne({ where: { id: pool.tokenBId } }));
    if (!tokenA || !tokenB) {
      throw new NotFoundException('Pool assets not found');
    }

    let reserveIn: number;
    let reserveOut: number;
    let tokenOut: string;

    if (dto.tokenIn === tokenA.symbol) {
      reserveIn = Number(pool.reserveA);
      reserveOut = Number(pool.reserveB);
      tokenOut = tokenB.symbol;
    } else if (dto.tokenIn === tokenB.symbol) {
      reserveIn = Number(pool.reserveB);
      reserveOut = Number(pool.reserveA);
      tokenOut = tokenA.symbol;
    } else {
      throw new BadRequestException(
        `Token ${dto.tokenIn} is not part of this pool`,
      );
    }

    const quote = this.ammService.getAmountOut(
      dto.amountIn,
      reserveIn,
      reserveOut,
      pool.feeBps,
    );

    if (dto.minAmountOut && quote.amountOut < dto.minAmountOut) {
      throw new BadRequestException(
        `Output ${quote.amountOut} is below minimum ${dto.minAmountOut}`,
      );
    }

    if (dto.tokenIn === tokenA.symbol) {
      pool.reserveA = Number(pool.reserveA) + dto.amountIn;
      pool.reserveB = Number(pool.reserveB) - quote.amountOut;
      pool.accumulatedFeesA = Number(pool.accumulatedFeesA) + quote.feeAmount;
    } else {
      pool.reserveB = Number(pool.reserveB) + dto.amountIn;
      pool.reserveA = Number(pool.reserveA) - quote.amountOut;
      pool.accumulatedFeesB = Number(pool.accumulatedFeesB) + quote.feeAmount;
    }

    pool.totalVolume = Number(pool.totalVolume) + dto.amountIn;
    pool.totalSwaps += 1;

    await this.distributeFeesToLps(
      pool,
      quote.feeAmount,
      dto.tokenIn === tokenA.symbol,
    );

    const swap = this.swapRepo.create({
      poolId,
      userId: dto.userId,
      tokenIn: dto.tokenIn,
      tokenOut,
      amountIn: dto.amountIn,
      amountOut: quote.amountOut,
      feePaid: quote.feeAmount,
      priceImpact: quote.priceImpact,
      status: 'COMPLETED',
    });

    const savedSwap = await this.swapRepo.save(swap);
    const savedPool = await this.poolRepo.save(pool);

    return { swap: savedSwap, pool: savedPool };
  }

  private async distributeFeesToLps(
    pool: LiquidityPool,
    feeAmount: number,
    isTokenA: boolean,
  ): Promise<void> {
    const positions = await this.positionRepo.find({
      where: { poolId: pool.id },
    });
    const totalLpSupply = Number(pool.totalLpSupply);

    for (const position of positions) {
      const share = this.ammService.distributeFees(
        feeAmount,
        Number(position.lpAmount),
        totalLpSupply,
      );
      if (isTokenA) {
        position.feesEarnedA = Number(position.feesEarnedA) + share;
      } else {
        position.feesEarnedB = Number(position.feesEarnedB) + share;
      }
      await this.positionRepo.save(position);
    }
  }

  async emergencyWithdraw(
    poolId: number,
    dto: EmergencyWithdrawDto,
  ): Promise<EmergencyWithdrawal> {
    const pool = await this.getPool(poolId);

    const position = await this.positionRepo.findOne({
      where: { poolId, userId: dto.userId },
    });
    if (!position || Number(position.lpAmount) < dto.lpAmount) {
      throw new BadRequestException(
        'Insufficient LP tokens for emergency withdrawal',
      );
    }

    const amounts = this.ammService.calculateWithdrawAmounts(
      dto.lpAmount,
      Number(pool.totalLpSupply),
      Number(pool.reserveA),
      Number(pool.reserveB),
    );

    const withdrawal = this.emergencyRepo.create({
      poolId,
      userId: dto.userId,
      lpAmountBurned: dto.lpAmount,
      amountA: amounts.amountA,
      amountB: amounts.amountB,
      reason: dto.reason,
      status: dto.adminApprovedBy
        ? EmergencyWithdrawalStatus.COMPLETED
        : EmergencyWithdrawalStatus.PENDING,
      adminApprovedBy: dto.adminApprovedBy,
    });

    pool.reserveA = Number(pool.reserveA) - amounts.amountA;
    pool.reserveB = Number(pool.reserveB) - amounts.amountB;
    pool.totalLpSupply = Number(pool.totalLpSupply) - dto.lpAmount;

    position.lpAmount = Number(position.lpAmount) - dto.lpAmount;

    await this.poolRepo.save(pool);
    await this.positionRepo.save(position);

    return this.emergencyRepo.save(withdrawal);
  }

  async getUserPositions(userId: number): Promise<PoolPosition[]> {
    return this.positionRepo.find({
      where: { userId },
      relations: ['pool', 'pool.tokenA', 'pool.tokenB'],
    });
  }

  async getPosition(positionId: number): Promise<PoolPosition> {
    const position = await this.positionRepo.findOne({
      where: { id: positionId },
      relations: ['pool', 'pool.tokenA', 'pool.tokenB'],
    });
    if (!position) {
      throw new NotFoundException(`Position ${positionId} not found`);
    }
    return position;
  }

  async quoteSwap(
    poolId: number,
    tokenIn: string,
    amountIn: number,
  ): Promise<ReturnType<AmmService['getAmountOut']>> {
    const pool = await this.getPool(poolId);
    const tokenA = pool.tokenA;
    const tokenB = pool.tokenB;

    if (!tokenA || !tokenB) {
      throw new NotFoundException('Pool assets not found');
    }

    let reserveIn: number;
    let reserveOut: number;

    if (tokenIn === tokenA.symbol) {
      reserveIn = Number(pool.reserveA);
      reserveOut = Number(pool.reserveB);
    } else if (tokenIn === tokenB.symbol) {
      reserveIn = Number(pool.reserveB);
      reserveOut = Number(pool.reserveA);
    } else {
      throw new BadRequestException(
        `Token ${tokenIn} is not part of this pool`,
      );
    }

    return this.ammService.getAmountOut(
      amountIn,
      reserveIn,
      reserveOut,
      pool.feeBps,
    );
  }
}
