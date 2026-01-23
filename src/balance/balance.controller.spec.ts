import { Test, TestingModule } from '@nestjs/testing';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { BalanceHistoryGuard } from '../common/guards/balance-history.guard';
import { BalanceHistoryQueryDto } from './dto/balance-history.dto';

describe('BalanceController', () => {
  let controller: BalanceController;
  let balanceService: jest.Mocked<BalanceService>;
  let balanceHistoryGuard: jest.Mocked<BalanceHistoryGuard>;

  const mockBalanceHistoryResponse = {
    data: [{
      asset: 'BTC',
      amountChanged: 0.5,
      reason: 'TRADE_EXECUTED',
      timestamp: '2024-01-15T10:30:00.000Z',
      resultingBalance: 1.5,
      transactionId: 'tx_123',
      relatedOrderId: 'order_456',
    }],
    total: 1,
    limit: 50,
    offset: 0,
    hasMore: false,
  };

  beforeEach(async () => {
    const mockBalanceService = {
      getUserBalances: jest.fn(),
      getBalanceHistory: jest.fn(),
    } as any;

    const mockBalanceHistoryGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceController],
      providers: [
        { provide: BalanceService, useValue: mockBalanceService },
        { provide: BalanceHistoryGuard, useValue: mockBalanceHistoryGuard },
      ],
    }).compile();

    controller = module.get<BalanceController>(BalanceController);
    balanceService = module.get(BalanceService);
    balanceHistoryGuard = module.get(BalanceHistoryGuard);
  });

  describe('getUserBalances', () => {
    it('should return user balances', async () => {
      const mockBalances = [
        { asset: 'BTC', balance: 1.5 },
        { asset: 'ETH', balance: 10.0 },
      ];
      balanceService.getUserBalances.mockResolvedValue(mockBalances);

      const result = await controller.getUserBalances('1');

      expect(balanceService.getUserBalances).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockBalances);
    });
  });

  describe('getBalanceHistory', () => {
    it('should return balance history for authenticated user', async () => {
      const query: BalanceHistoryQueryDto = {
        limit: 10,
        offset: 0,
      };

      balanceService.getBalanceHistory.mockResolvedValue(mockBalanceHistoryResponse);

      const result = await controller.getBalanceHistory(1, query);

      expect(balanceHistoryGuard.canActivate).toHaveBeenCalled();
      expect(balanceService.getBalanceHistory).toHaveBeenCalledWith('1', query);
      expect(result).toEqual(mockBalanceHistoryResponse);
    });

    it('should handle asset filtering', async () => {
      const query: BalanceHistoryQueryDto = {
        asset: 'BTC',
        limit: 10,
        offset: 0,
      };

      balanceService.getBalanceHistory.mockResolvedValue(mockBalanceHistoryResponse);

      await controller.getBalanceHistory(1, query);

      expect(balanceService.getBalanceHistory).toHaveBeenCalledWith('1', query);
    });

    it('should handle date range filtering', async () => {
      const query: BalanceHistoryQueryDto = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
        limit: 10,
        offset: 0,
      };

      balanceService.getBalanceHistory.mockResolvedValue(mockBalanceHistoryResponse);

      await controller.getBalanceHistory(1, query);

      expect(balanceService.getBalanceHistory).toHaveBeenCalledWith('1', query);
    });

    it('should handle pagination parameters', async () => {
      const query: BalanceHistoryQueryDto = {
        limit: 20,
        offset: 40,
      };

      balanceService.getBalanceHistory.mockResolvedValue(mockBalanceHistoryResponse);

      await controller.getBalanceHistory(1, query);

      expect(balanceService.getBalanceHistory).toHaveBeenCalledWith('1', query);
    });
  });
});
