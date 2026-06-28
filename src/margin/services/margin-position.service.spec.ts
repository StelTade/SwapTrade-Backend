import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { MarginPositionService } from './margin-position.service';
import { MarginPairConfigService } from './margin-pair-config.service';
import { MarginCalculatorService } from './margin-calculator.service';
import { MarginPosition } from '../entities/margin-position.entity';
import { PositionSide } from '../enums/position-side.enum';
import { PositionStatus } from '../enums/position-status.enum';

describe('MarginPositionService', () => {
  let service: MarginPositionService;
  let pairConfigService: { getById: jest.Mock };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let balanceRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };

  const pairConfig = {
    id: 1,
    baseAssetId: 1,
    quoteAssetId: 2,
    isEnabled: true,
    maxLeverage: 10,
    initialMarginRate: 0.1,
    maintenanceMarginRate: 0.05,
    volatilityPct: 5,
    volatilityLeverageFactor: 2,
  };

  beforeEach(async () => {
    pairConfigService = { getById: jest.fn().mockResolvedValue(pairConfig) };

    balanceRepo = {
      findOne: jest.fn().mockResolvedValue({
        userId: 1,
        assetId: 2,
        balance: 5000,
        lockedBalance: 0,
      }),
      save: jest.fn().mockImplementation((b) => Promise.resolve(b)),
    };

    dataSource = {
      getRepository: jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue({ id: 1, price: 100 }),
      })),
      transaction: jest.fn(async (cb) => {
        const manager = {
          getRepository: jest.fn(() => balanceRepo),
          create: jest.fn((_entity, data) => ({ ...data, id: 'pos-1' })),
          save: jest.fn((_entity, data) => Promise.resolve(data)),
          findOne: jest.fn(),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarginPositionService,
        MarginCalculatorService,
        { provide: MarginPairConfigService, useValue: pairConfigService },
        { provide: DataSource, useValue: dataSource },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: getRepositoryToken(MarginPosition),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(MarginPositionService);
  });

  it('opens a leveraged position when margin is sufficient', async () => {
    const position = await service.openPosition({
      userId: 1,
      pairConfigId: 1,
      side: PositionSide.LONG,
      collateral: 1000,
      leverage: 5,
    });

    expect(position.leverage).toBe(5);
    expect(position.collateral).toBe(1000);
    expect(Number(position.size)).toBe(50);
    expect(position.status).toBe(PositionStatus.OPEN);
  });

  it('rejects position when available margin is insufficient', async () => {
    balanceRepo.findOne.mockResolvedValue({
      userId: 1,
      assetId: 2,
      balance: 500,
      lockedBalance: 400,
    });

    await expect(
      service.openPosition({
        userId: 1,
        pairConfigId: 1,
        side: PositionSide.LONG,
        collateral: 1000,
        leverage: 5,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects leverage exceeding volatility-adjusted cap', async () => {
    pairConfigService.getById.mockResolvedValue({
      ...pairConfig,
      maxLeverage: 10,
      volatilityPct: 50,
      volatilityLeverageFactor: 2,
    });

    await expect(
      service.openPosition({
        userId: 1,
        pairConfigId: 1,
        side: PositionSide.LONG,
        collateral: 1000,
        leverage: 5,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
