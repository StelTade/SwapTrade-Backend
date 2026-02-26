import { Test, TestingModule } from '@nestjs/testing';
import { TradingService } from './trading.service';
import { UserBadgeService } from '../rewards/services/user-badge.service';
import { Trade } from './entities/trade.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeType } from '../common/enums/trade-type.enum';
import { UserService } from '../user/user.service';

describe('TradingService', () => {
  let service: TradingService;
  let tradeRepo: Repository<Trade>;
  let badgeService: UserBadgeService;
  let userService: UserService;

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
      ],
    }).compile();

    service = module.get<TradingService>(TradingService);
    tradeRepo = module.get<Repository<Trade>>(getRepositoryToken(Trade));
    badgeService = module.get<UserBadgeService>(UserBadgeService);
    userService = module.get<UserService>(UserService);
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
    (tradeRepo.count as jest.Mock).mockResolvedValue(1);
    (badgeService.awardBadge as jest.Mock).mockResolvedValue({});

    const result = await service.swap(userId, asset, amount, price, type);
    expect(result.success).toBe(true);
    expect(result.trade).toEqual(tradeEntity);
    expect(result.badgeAwarded).toBe(true);
    expect(tradeRepo.create).toHaveBeenCalledWith({
      userId,
      asset,
      amount,
      price,
      type: TradeType.BUY,
    });
    expect(userService.updatePortfolioAfterTrade).toHaveBeenCalledWith(
      userId.toString(),
      asset,
      amount * price,
      -(amount * price),
    );
    expect(userService.updateBalance).toHaveBeenCalledWith(
      userId.toString(),
      asset,
      amount,
    );
    expect(badgeService.awardBadge).toHaveBeenCalledWith(userId, 'First Trade');
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
    (tradeRepo.count as jest.Mock).mockResolvedValue(2);
    (badgeService.awardBadge as jest.Mock).mockResolvedValue(null);

    const result = await service.swap(userId, asset, amount, price, type);
    expect(result.success).toBe(true);
    expect(result.badgeAwarded).toBe(false);
    expect(userService.updatePortfolioAfterTrade).toHaveBeenCalledWith(
      userId.toString(),
      asset,
      amount * price,
      amount * price,
    );
    expect(userService.updateBalance).toHaveBeenCalledWith(
      userId.toString(),
      asset,
      -amount,
    );
    expect(badgeService.awardBadge).not.toHaveBeenCalled();
  });

  it('should return error for missing parameters', async () => {
  const result = await service.swap(0, '', 0, 0, '');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required swap parameters.');
  });
});
