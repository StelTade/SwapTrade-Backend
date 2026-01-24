import { Test, TestingModule } from '@nestjs/testing';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { BalanceHistoryGuard } from '../common/guards/balance-history.guard';
import { BalanceHistoryQueryDto } from './dto/balance-history.dto';
import { PaginationQueryDto } from '../common/interfaces/pagination.dto';

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
    it('should return user balances without pagination', async () => {
      const mockBalances = [
        { asset: 'BTC', balance: 1.5 },
        { asset: 'ETH', balance: 10.0 },
      ];
      balanceService.getUserBalances.mockResolvedValue(mockBalances);

      const result = await controller.getUserBalances('1');

      expect(balanceService.getUserBalances).toHaveBeenCalledWith('1', undefined);
      expect(result).toEqual(mockBalances);
    });

    it('should return paginated user balances with default pagination', async () => {
      const mockPaginatedResponse = {
        data: [
          { asset: 'BTC', balance: 1.5 },
          { asset: 'ETH', balance: 10.0 },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      };
      const pagination: PaginationQueryDto = {};
      balanceService.getUserBalances.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.getUserBalances('1', pagination);

      expect(balanceService.getUserBalances).toHaveBeenCalledWith('1', pagination);
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should return paginated user balances with custom limit', async () => {
      const mockPaginatedResponse = {
        data: Array.from({ length: 50 }, (_, i) => ({
          asset: `ASSET_${i}`,
          balance: i * 0.1,
        })),
        total: 150,
        limit: 50,
        offset: 0,
      };
      const pagination: PaginationQueryDto = { limit: 50, offset: 0 };
      balanceService.getUserBalances.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.getUserBalances('1', pagination);

      expect(balanceService.getUserBalances).toHaveBeenCalledWith('1', pagination);
      expect(result).toHaveProperty('limit', 50);
    });

    it('should return paginated user balances with custom offset', async () => {
      const mockPaginatedResponse = {
        data: [{ asset: 'BTC', balance: 1.5 }],
        total: 100,
        limit: 20,
        offset: 20,
      };
      const pagination: PaginationQueryDto = { limit: 20, offset: 20 };
      balanceService.getUserBalances.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.getUserBalances('1', pagination);

      expect(balanceService.getUserBalances).toHaveBeenCalledWith('1', pagination);
      expect(result).toHaveProperty('offset', 20);
    });

    it('should cap limit at 100', async () => {
      const mockPaginatedResponse = {
        data: Array.from({ length: 100 }, (_, i) => ({
          asset: `ASSET_${i}`,
          balance: i * 0.1,
        })),
        total: 500,
        limit: 100,
        offset: 0,
      };
      const pagination: PaginationQueryDto = { limit: 200, offset: 0 };
      balanceService.getUserBalances.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.getUserBalances('1', pagination);

      expect(balanceService.getUserBalances).toHaveBeenCalledWith('1', pagination);
      expect(result).toHaveProperty('limit', 100);
    });

    it('should handle empty paginated response', async () => {
      const mockPaginatedResponse = {
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      };
      const pagination: PaginationQueryDto = { limit: 20, offset: 0 };
      balanceService.getUserBalances.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.getUserBalances('1', pagination);

      expect(result).toEqual(mockPaginatedResponse);
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
