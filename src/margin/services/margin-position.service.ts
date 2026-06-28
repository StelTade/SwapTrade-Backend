import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MarginPosition } from '../entities/margin-position.entity';
import { MarginPairConfig } from '../entities/margin-pair-config.entity';
import { UserBalance } from '../../database/entities/user-balance.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { PositionSide } from '../enums/position-side.enum';
import { PositionStatus } from '../enums/position-status.enum';
import { MarginCalculatorService } from './margin-calculator.service';
import { MarginPairConfigService } from './margin-pair-config.service';
import { OpenMarginPositionDto } from '../dto/open-margin-position.dto';
import { PositionOpenedEvent } from '../../infrastructure/events/domain.events';

@Injectable()
export class MarginPositionService {
  constructor(
    @InjectRepository(MarginPosition)
    private readonly positionRepo: Repository<MarginPosition>,
    private readonly pairConfigService: MarginPairConfigService,
    private readonly calculator: MarginCalculatorService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async openPosition(dto: OpenMarginPositionDto): Promise<MarginPosition> {
    const pairConfig = await this.pairConfigService.getById(dto.pairConfigId);
    if (!pairConfig.isEnabled) {
      throw new BadRequestException('Margin trading is disabled for this pair');
    }

    const effectiveMaxLeverage =
      this.calculator.calculateEffectiveMaxLeverage(pairConfig);
    if (dto.leverage > effectiveMaxLeverage) {
      throw new BadRequestException(
        `Leverage ${dto.leverage}x exceeds maximum ${effectiveMaxLeverage}x for this pair (volatility-adjusted)`,
      );
    }

    const minInitialMargin = 1 / dto.leverage;
    if (Number(pairConfig.initialMarginRate) > minInitialMargin + 1e-8) {
      throw new BadRequestException(
        `Leverage ${dto.leverage}x requires at least ${(1 / Number(pairConfig.initialMarginRate)).toFixed(2)}x max leverage for this pair`,
      );
    }

    const baseAsset = await this.dataSource
      .getRepository(VirtualAsset)
      .findOne({ where: { id: pairConfig.baseAssetId } });
    if (!baseAsset) {
      throw new NotFoundException('Base asset not found');
    }

    const entryPrice = dto.entryPrice ?? Number(baseAsset.price);
    if (entryPrice <= 0) {
      throw new BadRequestException('Invalid entry price');
    }

    const notional = dto.collateral * dto.leverage;
    const size = this.calculator.calculatePositionSize(notional, entryPrice);
    const borrowedAmount = this.calculator.calculateBorrowedAmount(
      notional,
      dto.collateral,
    );

    const liquidationPrice = this.calculator.calculateLiquidationPrice(
      dto.side,
      size,
      entryPrice,
      dto.collateral,
      Number(pairConfig.maintenanceMarginRate),
    );

    return this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(UserBalance);
      const balance = await balanceRepo.findOne({
        where: {
          userId: dto.userId,
          assetId: pairConfig.quoteAssetId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new BadRequestException(
          'Insufficient margin: no quote asset balance found',
        );
      }

      const available = Number(balance.balance) - Number(balance.lockedBalance);
      if (available < dto.collateral) {
        throw new BadRequestException(
          `Insufficient available margin: need ${dto.collateral}, have ${available}`,
        );
      }

      balance.lockedBalance = Number(balance.lockedBalance) + dto.collateral;
      await balanceRepo.save(balance);

      const position = manager.create(MarginPosition, {
        userId: dto.userId,
        pairConfigId: pairConfig.id,
        side: dto.side,
        size,
        entryPrice,
        leverage: dto.leverage,
        collateral: dto.collateral,
        borrowedAmount,
        liquidationPrice,
        unrealizedPnl: 0,
        accruedInterest: 0,
        status: PositionStatus.OPEN,
      });

      const saved = await manager.save(MarginPosition, position);

      this.eventEmitter.emit(
        'position.opened',
        new PositionOpenedEvent(
          saved.id,
          saved.userId,
          pairConfig.id,
          dto.side,
          dto.leverage,
          dto.collateral,
        ),
      );

      return saved;
    });
  }

  async closePosition(
    positionId: string,
    currentPrice: number,
  ): Promise<MarginPosition> {
    return this.dataSource.transaction(async (manager) => {
      const position = await manager.findOne(MarginPosition, {
        where: { id: positionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!position) {
        throw new NotFoundException(`Position ${positionId} not found`);
      }

      if (
        position.status !== PositionStatus.OPEN &&
        position.status !== PositionStatus.MARGIN_CALL
      ) {
        throw new BadRequestException(
          `Position ${positionId} is not open (status=${position.status})`,
        );
      }

      const pairConfig = await manager.findOne(MarginPairConfig, {
        where: { id: position.pairConfigId },
      });
      if (!pairConfig) {
        throw new NotFoundException('Pair config not found');
      }

      const pnl = this.calculator.calculateUnrealizedPnl(
        position.side,
        Number(position.size),
        Number(position.entryPrice),
        currentPrice,
      );
      const equity = this.calculator.calculateEquity(
        Number(position.collateral),
        pnl,
        Number(position.accruedInterest),
      );

      await this.settlePositionBalance(
        manager,
        position,
        pairConfig.quoteAssetId,
        equity,
      );

      position.unrealizedPnl = pnl;
      position.status = PositionStatus.CLOSED;
      position.closedAt = new Date();
      return manager.save(MarginPosition, position);
    });
  }

  async liquidatePosition(
    position: MarginPosition,
    pairConfig: MarginPairConfig,
    currentPrice: number,
  ): Promise<{ position: MarginPosition; shortfall: number }> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(MarginPosition, {
        where: { id: position.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !locked ||
        (locked.status !== PositionStatus.OPEN &&
          locked.status !== PositionStatus.MARGIN_CALL)
      ) {
        return { position: locked ?? position, shortfall: 0 };
      }

      const pnl = this.calculator.calculateUnrealizedPnl(
        locked.side,
        Number(locked.size),
        Number(locked.entryPrice),
        currentPrice,
      );
      const equity = this.calculator.calculateEquity(
        Number(locked.collateral),
        pnl,
        Number(locked.accruedInterest),
      );

      const shortfall = equity < 0 ? Math.abs(equity) : 0;

      await this.settlePositionBalance(
        manager,
        locked,
        pairConfig.quoteAssetId,
        Math.max(0, equity),
      );

      locked.unrealizedPnl = pnl;
      locked.status = PositionStatus.LIQUIDATED;
      locked.liquidatedAt = new Date();
      const saved = await manager.save(MarginPosition, locked);

      return { position: saved, shortfall };
    });
  }

  async getOpenPositions(): Promise<MarginPosition[]> {
    return this.positionRepo.find({
      where: [
        { status: PositionStatus.OPEN },
        { status: PositionStatus.MARGIN_CALL },
      ],
    });
  }

  async getUserPositions(userId: number): Promise<MarginPosition[]> {
    return this.positionRepo.find({
      where: { userId },
      order: { openedAt: 'DESC' },
    });
  }

  async getPosition(id: string): Promise<MarginPosition> {
    const position = await this.positionRepo.findOne({ where: { id } });
    if (!position) {
      throw new NotFoundException(`Position ${id} not found`);
    }
    return position;
  }

  private async settlePositionBalance(
    manager: DataSource['manager'],
    position: MarginPosition,
    quoteAssetId: number,
    equity: number,
  ): Promise<void> {
    const balanceRepo = manager.getRepository(UserBalance);
    const balance = await balanceRepo.findOne({
      where: { userId: position.userId, assetId: quoteAssetId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!balance) return;

    const collateral = Number(position.collateral);
    balance.lockedBalance = Math.max(
      0,
      Number(balance.lockedBalance) - collateral,
    );

    const balanceDelta = equity - collateral;
    balance.balance = Number(balance.balance) + balanceDelta;
    await balanceRepo.save(balance);
  }
}
