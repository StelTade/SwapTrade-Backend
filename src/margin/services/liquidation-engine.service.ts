import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MarginPosition } from '../entities/margin-position.entity';
import { MarginPairConfig } from '../entities/margin-pair-config.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { PositionStatus } from '../enums/position-status.enum';
import { MarginCalculatorService } from './margin-calculator.service';
import { MarginPositionService } from './margin-position.service';
import { LiquidationProtectionService } from '../../protection/services/liquidation-protection.service';
import {
  MarginCallEvent,
  PositionLiquidatedEvent,
} from '../../infrastructure/events/domain.events';

@Injectable()
export class LiquidationEngineService {
  private readonly logger = new Logger(LiquidationEngineService.name);

  constructor(
    @InjectRepository(MarginPosition)
    private readonly positionRepo: Repository<MarginPosition>,
    @InjectRepository(MarginPairConfig)
    private readonly pairConfigRepo: Repository<MarginPairConfig>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
    private readonly calculator: MarginCalculatorService,
    private readonly positionService: MarginPositionService,
    private readonly liquidationProtection: LiquidationProtectionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async monitorPositions(): Promise<void> {
    const positions = await this.positionService.getOpenPositions();
    if (positions.length === 0) return;

    const pairIds = [...new Set(positions.map((p) => p.pairConfigId))];
    const pairs = await this.pairConfigRepo.findBy({ id: In(pairIds) });
    const pairById = new Map(pairs.map((p) => [p.id, p]));

    const assetIds = [
      ...new Set(pairs.flatMap((p) => [p.baseAssetId, p.quoteAssetId])),
    ];
    const assets = await this.assetRepo.findBy({ id: In(assetIds) });
    const priceByAsset = new Map(assets.map((a) => [a.id, Number(a.price)]));

    for (const position of positions) {
      const pairConfig = pairById.get(position.pairConfigId);
      if (!pairConfig) continue;

      const currentPrice = priceByAsset.get(pairConfig.baseAssetId);
      if (currentPrice == null || currentPrice <= 0) continue;

      try {
        await this.evaluatePosition(position, pairConfig, currentPrice);
      } catch (err) {
        this.logger.error(`Failed to evaluate position ${position.id}: ${err}`);
      }
    }
  }

  async evaluatePosition(
    position: MarginPosition,
    pairConfig: MarginPairConfig,
    currentPrice: number,
  ): Promise<void> {
    const metrics = this.calculator.computeMetrics(
      position.side,
      Number(position.size),
      Number(position.entryPrice),
      currentPrice,
      Number(position.collateral),
      Number(position.accruedInterest),
      Number(pairConfig.maintenanceMarginRate),
    );

    position.unrealizedPnl = metrics.unrealizedPnl;
    await this.positionRepo.save(position);

    if (
      this.calculator.shouldLiquidate(
        metrics.equity,
        metrics.maintenanceRequirement,
      )
    ) {
      await this.liquidate(position, pairConfig, currentPrice, metrics.equity);
      return;
    }

    if (
      this.calculator.shouldMarginCall(
        metrics.marginRatio,
        Number(pairConfig.marginCallThresholdRatio),
      )
    ) {
      await this.triggerMarginCall(position, pairConfig, currentPrice, metrics);
    } else if (position.status === PositionStatus.MARGIN_CALL) {
      position.status = PositionStatus.OPEN;
      await this.positionRepo.save(position);
    }
  }

  private async liquidate(
    position: MarginPosition,
    pairConfig: MarginPairConfig,
    currentPrice: number,
    equity: number,
  ): Promise<void> {
    this.logger.warn(
      `Liquidating position ${position.id} for user ${position.userId} at price ${currentPrice} (equity=${equity.toFixed(4)})`,
    );

    const { position: liquidated, shortfall } =
      await this.positionService.liquidatePosition(
        position,
        pairConfig,
        currentPrice,
      );

    if (shortfall > 0) {
      try {
        await this.liquidationProtection.coverShortfall(
          position.userId,
          shortfall,
          position.id,
        );
      } catch (err) {
        this.logger.error(
          `Insurance shortfall coverage failed for position ${position.id}: ${err}`,
        );
      }
    }

    this.eventEmitter.emit(
      'position.liquidated',
      new PositionLiquidatedEvent(
        liquidated.id,
        liquidated.userId,
        currentPrice,
        equity,
        shortfall,
      ),
    );
  }

  private async triggerMarginCall(
    position: MarginPosition,
    pairConfig: MarginPairConfig,
    currentPrice: number,
    metrics: ReturnType<MarginCalculatorService['computeMetrics']>,
  ): Promise<void> {
    const alreadyNotified = position.marginCallNotifiedAt != null;
    const recentlyNotified =
      alreadyNotified &&
      Date.now() - position.marginCallNotifiedAt.getTime() < 3600_000;

    if (position.status !== PositionStatus.MARGIN_CALL) {
      position.status = PositionStatus.MARGIN_CALL;
    }

    if (!recentlyNotified) {
      position.marginCallNotifiedAt = new Date();
      await this.positionRepo.save(position);

      this.eventEmitter.emit(
        'margin.call',
        new MarginCallEvent(
          position.id,
          position.userId,
          pairConfig.id,
          currentPrice,
          metrics.marginRatio,
          Number(position.liquidationPrice),
        ),
      );
    } else {
      await this.positionRepo.save(position);
    }
  }
}
