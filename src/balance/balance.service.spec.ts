import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from './balance.service';
import { BalanceAudit } from './balance-audit.entity';
import { Balance } from './balance.entity';
import { UserBalance } from './user-balance.entity';
import { BalanceHistoryQueryDto } from './dto/balance-history.dto';
import { PaginationQueryDto } from '../common/interfaces/pagination.dto';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CacheService } from '../common/services/cache.service';

describe('BalanceService', () => {
  let service: BalanceService;
  let balanceAuditRepository: jest.Mocked<Repository<BalanceAudit>>;
  let balanceRepository: jest.Mocked<Repository<Balance>>;
  let userBalanceRepository: jest.Mocked<Repository<UserBalance>>;
  let dataSource: jest.Mocked<DataSource>;
  let cacheService: jest.Mocked<CacheService>;

  const mockBalanceAudit: BalanceAudit = {
    id: 1,
    userId: '1',
    asset: 'BTC',
    amountChanged: 0.5,
    resultingBalance: 1.5,
    reason: 'TRADE_EXECUTED',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    transactionId: 'tx_123',
    relatedOrderId: 'order_456',
    previousBalance: 1.0,
  };

  const mockBalance: Balance = {
    id: 1,
    userId: '1',
    asset: 'BTC',
    balance: 1.5,
    available: 1.5,
  };

  beforeEach(async () => {
    const mockBalanceAuditRepository = {
      count: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    const mockBalanceRepository = {
      find: jest.fn(),
      findAndCount: jest.fn(),
    } as any;

    const mockUserBalanceRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    const mockDataSource = {
      manager: jest.fn(),
      transaction: jest.fn(),
    } as any;

    const mockCacheService = {
      getUserBalanceCache: jest.fn(),
      setUserBalanceCache: jest.fn(),
      invalidateBalanceRelatedCaches: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: getRepositoryToken(BalanceAudit),
          useValue: mockBalanceAuditRepository,
        },
        {
          provide: getRepositoryToken(Balance),
          useValue: mockBalanceRepository,
        },
        {
          provide: getRepositoryToken(UserBalance),
          useValue: mockUserBalanceRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    balanceAuditRepository = module.get(getRepositoryToken(BalanceAudit));
    balanceRepository = module.get(getRepositoryToken(Balance));
    userBalanceRepository = module.get(getRepositoryToken(UserBalance));
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  describe('getUserBalances', () => {
    it('should return non-paginated array when no pagination provided', async () => {
      cacheService.getUserBalanceCache.mockRejectedValue(new Error('Cache miss'));
      balanceRepository.find.mockResolvedValue([mockBalance]);

      const result = await service.getUserBalances('1');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([
        {
          asset: 'BTC',
          balance: 1.5,
        },
      ]);
    });

    it('should return paginated response with default pagination', async () => {
      const pagination: PaginationQueryDto = {};
      balanceRepository.findAndCount.mockResolvedValue([
        [mockBalance],
        1,
      ]);

      const result = await service.getUserBalances('1', pagination);

      expect(balanceRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: '1' },
        skip: 0,
        take: 20,
        order: { asset: 'ASC' },
      });
      expect(result).toEqual({
        data: [
          {
            asset: 'BTC',
            balance: 1.5,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      });
    });

    it('should return paginated response with custom limit', async () => {
      const pagination: PaginationQueryDto = { limit: 50, offset: 0 };
      balanceRepository.findAndCount.mockResolvedValue([
        [mockBalance],
        1,
      ]);

      const result = await service.getUserBalances('1', pagination);

      expect(balanceRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: '1' },
        skip: 0,
        take: 50,
        order: { asset: 'ASC' },
      });
      expect(result).toHaveProperty('limit', 50);
    });

    it('should cap limit at 100 when exceeded', async () => {
      const pagination: PaginationQueryDto = { limit: 200, offset: 0 };
      balanceRepository.findAndCount.mockResolvedValue([
        [mockBalance],
        1,
      ]);

      const result = await service.getUserBalances('1', pagination);

      expect(balanceRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: '1' },
        skip: 0,
        take: 100,
        order: { asset: 'ASC' },
      });
      expect(result).toHaveProperty('limit', 100);
    });

    it('should reject negative offset with BadRequestException', async () => {
      const pagination: PaginationQueryDto = { limit: 20, offset: -1 };

      await expect(
        service.getUserBalances('1', pagination),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return paginated response with custom offset', async () => {
      const pagination: PaginationQueryDto = { limit: 20, offset: 10 };
      balanceRepository.findAndCount.mockResolvedValue([
        [mockBalance],
        100,
      ]);

      const result = await service.getUserBalances('1', pagination);

      expect(balanceRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: '1' },
        skip: 10,
        take: 20,
        order: { asset: 'ASC' },
      });
      expect(result).toHaveProperty('offset', 10);
      expect(result).toHaveProperty('total', 100);
    });

    it('should handle empty balance list with pagination', async () => {
      const pagination: PaginationQueryDto = { limit: 20, offset: 0 };
      balanceRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getUserBalances('1', pagination);

      expect(result).toEqual({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      });
    });

    it('should handle large dataset pagination', async () => {
      const pagination: PaginationQueryDto = { limit: 20, offset: 0 };
      const largeDataset = Array.from({ length: 20 }, (_, i) => ({
        ...mockBalance,
        id: i,
        asset: `ASSET_${i}`,
      }));
      balanceRepository.findAndCount.mockResolvedValue([
        largeDataset,
        1000,
      ]);

      const result = await service.getUserBalances('1', pagination);

      expect(result).toHaveProperty('total', 1000);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(20);
    });

    it('should use cache when available for non-paginated requests', async () => {
      const cachedData = [{ asset: 'BTC', balance: 1.5 }];
      cacheService.getUserBalanceCache.mockResolvedValue(cachedData);

      const result = await service.getUserBalances('1');

      expect(cacheService.getUserBalanceCache).toHaveBeenCalledWith('1');
      expect(result).toEqual(cachedData);
      expect(balanceRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('getBalanceHistory', () => {
    it('should return paginated balance history for user', async () => {
      const query: BalanceHistoryQueryDto = {
        limit: 10,
        offset: 0,
      };

      balanceAuditRepository.count.mockResolvedValue(1);
      balanceAuditRepository.find.mockResolvedValue([mockBalanceAudit]);

      const result = await service.getBalanceHistory('1', query);

      expect(balanceAuditRepository.count).toHaveBeenCalledWith({
        where: { userId: '1' },
      });
      expect(balanceAuditRepository.find).toHaveBeenCalledWith({
        where: { userId: '1' },
        order: { timestamp: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
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
        limit: 10,
        offset: 0,
        hasMore: false,
      });
    });

    it('should filter by asset', async () => {
      const query: BalanceHistoryQueryDto = {
        asset: 'BTC',
        limit: 10,
        offset: 0,
      };

      balanceAuditRepository.count.mockResolvedValue(1);
      balanceAuditRepository.find.mockResolvedValue([mockBalanceAudit]);

      await service.getBalanceHistory('1', query);

      expect(balanceAuditRepository.count).toHaveBeenCalledWith({
        where: { userId: '1', asset: 'BTC' },
      });
      expect(balanceAuditRepository.find).toHaveBeenCalledWith({
        where: { userId: '1', asset: 'BTC' },
        order: { timestamp: 'DESC' },
        take: 10,
        skip: 0,
      });
    });

    it('should filter by date range', async () => {
      const query: BalanceHistoryQueryDto = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
        limit: 10,
        offset: 0,
      };

      balanceAuditRepository.count.mockResolvedValue(1);
      balanceAuditRepository.find.mockResolvedValue([mockBalanceAudit]);

      await service.getBalanceHistory('1', query);

      expect(balanceAuditRepository.count).toHaveBeenCalledWith({
        where: {
          userId: '1',
          timestamp: expect.any(Object),
        },
      });
      expect(balanceAuditRepository.find).toHaveBeenCalledWith({
        where: {
          userId: '1',
          timestamp: expect.any(Object),
        },
        order: { timestamp: 'DESC' },
        take: 10,
        skip: 0,
      });
    });

    it('should return empty array when no history exists', async () => {
      const query: BalanceHistoryQueryDto = {
        limit: 10,
        offset: 0,
      };

      balanceAuditRepository.count.mockResolvedValue(0);
      balanceAuditRepository.find.mockResolvedValue([]);

      const result = await service.getBalanceHistory('1', query);

      expect(result).toEqual({
        data: [],
        total: 0,
        limit: 10,
        offset: 0,
        hasMore: false,
      });
    });

    it('should calculate hasMore correctly', async () => {
      const query: BalanceHistoryQueryDto = {
        limit: 10,
        offset: 0,
      };

      balanceAuditRepository.count.mockResolvedValue(25);
      balanceAuditRepository.find.mockResolvedValue([mockBalanceAudit]);

      const result = await service.getBalanceHistory('1', query);

      expect(result.hasMore).toBe(true);
    });
  });

  describe('addBalanceAuditEntry', () => {
    it('should create and save balance audit entry', async () => {
      const auditData = {
        userId: '1',
        asset: 'BTC',
        amountChanged: 0.5,
        resultingBalance: 1.5,
        reason: 'TRADE_EXECUTED',
        transactionId: 'tx_123',
        relatedOrderId: 'order_456',
        previousBalance: 1.0,
      };

      balanceAuditRepository.create.mockReturnValue(mockBalanceAudit);
      balanceAuditRepository.save.mockResolvedValue(mockBalanceAudit);

      const result = await service.addBalanceAuditEntry(auditData);

      expect(balanceAuditRepository.create).toHaveBeenCalledWith(auditData);
      expect(balanceAuditRepository.save).toHaveBeenCalledWith(mockBalanceAudit);
      expect(result).toBe(mockBalanceAudit);
    });
  });
});
