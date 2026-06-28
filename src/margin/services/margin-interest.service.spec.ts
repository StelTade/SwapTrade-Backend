import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MarginInterestService } from './margin-interest.service';
import { MarginCalculatorService } from './margin-calculator.service';
import { MarginPosition } from '../entities/margin-position.entity';
import { MarginInterestAccrual } from '../entities/margin-interest-accrual.entity';
import { MarginPairConfig } from '../entities/margin-pair-config.entity';
import { PositionStatus } from '../enums/position-status.enum';

describe('MarginInterestService', () => {
  let service: MarginInterestService;
  let positionRepo: { find: jest.Mock; save: jest.Mock };
  let accrualRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    positionRepo = {
      find: jest.fn(),
      save: jest.fn((p) => Promise.resolve(p)),
    };
    accrualRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((d) => d),
      save: jest.fn((d) => ({ ...d, id: 'acc-1' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarginInterestService,
        MarginCalculatorService,
        {
          provide: getRepositoryToken(MarginPosition),
          useValue: positionRepo,
        },
        {
          provide: getRepositoryToken(MarginInterestAccrual),
          useValue: accrualRepo,
        },
        {
          provide: getRepositoryToken(MarginPairConfig),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ dailyInterestRateBps: 10 }),
          },
        },
      ],
    }).compile();

    service = module.get(MarginInterestService);
  });

  it('accrues daily interest and creates auditable record', async () => {
    const position = {
      id: 'pos-1',
      userId: 1,
      pairConfigId: 1,
      borrowedAmount: 10000,
      accruedInterest: 0,
      status: PositionStatus.OPEN,
    } as MarginPosition;

    const pairConfig = { dailyInterestRateBps: 10 } as MarginPairConfig;

    const record = await service.accrueForPosition(
      position,
      pairConfig,
      '2026-06-28',
    );

    expect(record.interestAmount).toBe(10);
    expect(record.accruedTotalAfter).toBe(10);
    expect(record.accrualDate).toBe('2026-06-28');
    expect(accrualRepo.save).toHaveBeenCalled();
  });

  it('skips duplicate accrual for the same day', async () => {
    positionRepo.find.mockResolvedValue([
      {
        id: 'pos-1',
        userId: 1,
        pairConfigId: 1,
        borrowedAmount: 5000,
        accruedInterest: 0,
        status: PositionStatus.OPEN,
      },
    ]);
    accrualRepo.findOne.mockResolvedValue({ id: 'existing' });

    await service.accrueDailyInterest();

    expect(accrualRepo.save).not.toHaveBeenCalled();
  });
});
