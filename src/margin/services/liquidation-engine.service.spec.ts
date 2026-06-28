import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiquidationEngineService } from './liquidation-engine.service';
import { MarginCalculatorService } from './margin-calculator.service';
import { MarginPositionService } from './margin-position.service';
import { LiquidationProtectionService } from '../../protection/services/liquidation-protection.service';
import { MarginPosition } from '../entities/margin-position.entity';
import { MarginPairConfig } from '../entities/margin-pair-config.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { PositionSide } from '../enums/position-side.enum';
import { PositionStatus } from '../enums/position-status.enum';

describe('LiquidationEngineService', () => {
  let service: LiquidationEngineService;
  let positionRepo: { save: jest.Mock };
  let positionService: {
    getOpenPositions: jest.Mock;
    liquidatePosition: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };

  const pairConfig: MarginPairConfig = {
    id: 1,
    baseAssetId: 1,
    quoteAssetId: 2,
    maxLeverage: 10,
    initialMarginRate: 0.1,
    maintenanceMarginRate: 0.05,
    dailyInterestRateBps: 10,
    volatilityPct: 5,
    volatilityLeverageFactor: 2,
    marginCallThresholdRatio: 1.15,
    isEnabled: true,
  } as MarginPairConfig;

  beforeEach(async () => {
    positionRepo = { save: jest.fn((p) => Promise.resolve(p)) };
    positionService = {
      getOpenPositions: jest.fn(),
      liquidatePosition: jest.fn().mockResolvedValue({
        position: { id: 'pos-1', status: PositionStatus.LIQUIDATED },
        shortfall: 0,
      }),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidationEngineService,
        MarginCalculatorService,
        { provide: MarginPositionService, useValue: positionService },
        {
          provide: LiquidationProtectionService,
          useValue: { coverShortfall: jest.fn() },
        },
        {
          provide: getRepositoryToken(MarginPosition),
          useValue: positionRepo,
        },
        {
          provide: getRepositoryToken(MarginPairConfig),
          useValue: {
            findBy: jest.fn().mockResolvedValue([pairConfig]),
          },
        },
        {
          provide: getRepositoryToken(VirtualAsset),
          useValue: {
            findBy: jest.fn().mockResolvedValue([{ id: 1, price: 80 }]),
          },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(LiquidationEngineService);
  });

  it('liquidates underwater long positions before equity goes negative', async () => {
    const position: MarginPosition = {
      id: 'pos-1',
      userId: 1,
      pairConfigId: 1,
      side: PositionSide.LONG,
      size: 10,
      entryPrice: 100,
      leverage: 5,
      collateral: 200,
      borrowedAmount: 800,
      liquidationPrice: 85,
      unrealizedPnl: 0,
      accruedInterest: 0,
      status: PositionStatus.OPEN,
    } as MarginPosition;

    positionService.getOpenPositions.mockResolvedValue([position]);

    await service.monitorPositions();

    expect(positionService.liquidatePosition).toHaveBeenCalledWith(
      position,
      pairConfig,
      80,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'position.liquidated',
      expect.any(Object),
    );
  });

  it('emits margin call when ratio drops below threshold', async () => {
    const position: MarginPosition = {
      id: 'pos-2',
      userId: 1,
      pairConfigId: 1,
      side: PositionSide.LONG,
      size: 10,
      entryPrice: 100,
      leverage: 5,
      collateral: 110,
      borrowedAmount: 400,
      liquidationPrice: 85,
      unrealizedPnl: 0,
      accruedInterest: 0,
      status: PositionStatus.OPEN,
      marginCallNotifiedAt: null,
    } as MarginPosition;

    positionService.getOpenPositions.mockResolvedValue([position]);

    await service.evaluatePosition(position, pairConfig, 94);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'margin.call',
      expect.objectContaining({ positionId: 'pos-2' }),
    );
  });
});
