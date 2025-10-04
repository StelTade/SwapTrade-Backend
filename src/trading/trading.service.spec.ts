import { Test, TestingModule } from '@nestjs/testing';
import { TradingService } from './trading.service';
import { UserBadgeService } from '../rewards/services/user-badge.service';
import { Trade } from './entities/trade.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeType } from '../common/enums/trade-type.enum';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';

describe('TradingService', () => {
  let service: TradingService;
  let tradeRepo: Repository<Trade>;
  let badgeService: UserBadgeService;
  let notificationService: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingService,
        {
          provide: getRepositoryToken(Trade),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: UserBadgeService,
          useValue: {
            awardBadge: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            updatePortfolioAfterTrade: jest.fn(),
            updateBalance: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TradingService>(TradingService);
    tradeRepo = module.get<Repository<Trade>>(getRepositoryToken(Trade));
    badgeService = module.get<UserBadgeService>(UserBadgeService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  it('should create a trade and award badge on first trade', async () => {
    const userId = 1;
    const asset = 'BTC';
    const amount = 1;
    const price = 50000;
    const type = 'BUY';
    const tradeEntity = { userId, asset, amount, price, type: TradeType.BUY } as Trade;

    (tradeRepo.create as jest.Mock).mockReturnValue(tradeEntity);
    (tradeRepo.save as jest.Mock).mockResolvedValue(tradeEntity);
    (tradeRepo.count as jest.Mock).mockResolvedValueOnce(0); // Before trade
    (tradeRepo.count as jest.Mock).mockResolvedValueOnce(1); // After trade
    (badgeService.awardBadge as jest.Mock).mockResolvedValue({});

    const result = await service.swap(userId, asset, amount, price, type);
    expect(result.success).toBe(true);
    expect(result.trade).toEqual(tradeEntity);
    expect(result.badgeAwarded).toBe(true);
    expect(tradeRepo.create).toHaveBeenCalledWith({ userId, asset, amount, price, type: TradeType.BUY });
    expect(badgeService.awardBadge).toHaveBeenCalledWith(userId, 'First Trade');
    expect(notificationService.sendEvent).toHaveBeenCalledWith(
      userId,
      NotificationEventType.ORDER_FILLED,
      `Order ${type} ${amount} ${asset} at ${price} filled`,
    );
    expect(notificationService.sendEvent).toHaveBeenCalledWith(
      userId,
      NotificationEventType.ACHIEVEMENT_UNLOCKED,
      'Achievement unlocked: First Trade',
    );
  });

  it('should not award badge on subsequent trades', async () => {
    const userId = 2;
    const asset = 'ETH';
    const amount = 2;
    const price = 3000;
    const type = 'SELL';
    const tradeEntity = { userId, asset, amount, price, type: TradeType.SELL } as Trade;

    (tradeRepo.create as jest.Mock).mockReturnValue(tradeEntity);
    (tradeRepo.save as jest.Mock).mockResolvedValue(tradeEntity);
    (tradeRepo.count as jest.Mock).mockResolvedValue(2); // Already has trades
    (badgeService.awardBadge as jest.Mock).mockResolvedValue(null);

    const result = await service.swap(userId, asset, amount, price, type);
    expect(result.success).toBe(true);
    expect(result.badgeAwarded).toBe(false);
    expect(badgeService.awardBadge).not.toHaveBeenCalled();
    expect(notificationService.sendEvent).toHaveBeenCalledWith(
      userId,
      NotificationEventType.ORDER_FILLED,
      `Order ${type} ${amount} ${asset} at ${price} filled`,
    );
  });

  it('should return error for missing parameters', async () => {
  const result = await service.swap(0, '', 0, 0, '');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required swap parameters.');
  });
});
