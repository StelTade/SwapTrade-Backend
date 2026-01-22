import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from './balance.service';
import { BalanceAudit } from './balance-audit.entity';
import { Balance } from './balance.entity';
import { BalanceHistoryQueryDto } from './dto/balance-history.dto';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('BalanceService', () => {
  let service: BalanceService;
  let balanceAuditRepository: jest.Mocked<Repository<BalanceAudit>>;
  let balanceRepository: jest.Mocked<Repository<Balance>>;

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

  beforeEach(async () => {
    const mockBalanceAuditRepository = {
      count: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    const mockBalanceRepository = {
      find: jest.fn(),
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
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    balanceAuditRepository = module.get(getRepositoryToken(BalanceAudit));
    balanceRepository = module.get(getRepositoryToken(Balance));
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
