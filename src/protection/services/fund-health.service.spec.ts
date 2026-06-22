import {
  FundHealthService,
  HEALTH_WARNING_THRESHOLD,
} from './fund-health.service';
import { FundHealthStatus } from '../enums/fund-health-status.enum';

describe('FundHealthService', () => {
  let service: FundHealthService;
  const mockEventEmitter = { emit: jest.fn() };
  const mockFundRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((f) => f),
  };

  beforeEach(() => {
    service = new FundHealthService(
      mockFundRepo as never,
      mockEventEmitter as never,
    );
    jest.clearAllMocks();
  });

  describe('calculateHealthPercent', () => {
    it('should return percentage of balance vs target', () => {
      expect(service.calculateHealthPercent(50000, 100000)).toBe(50);
    });

    it('should cap at 100%', () => {
      expect(service.calculateHealthPercent(150000, 100000)).toBe(100);
    });
  });

  describe('resolveHealthStatus', () => {
    it('should return CRITICAL below 20%', () => {
      expect(service.resolveHealthStatus(15)).toBe(FundHealthStatus.CRITICAL);
    });

    it('should return WARNING between 20% and 50%', () => {
      expect(service.resolveHealthStatus(30)).toBe(FundHealthStatus.WARNING);
    });

    it('should return HEALTHY above 50%', () => {
      expect(service.resolveHealthStatus(75)).toBe(FundHealthStatus.HEALTHY);
    });

    it('should return DEPLETED at 0%', () => {
      expect(service.resolveHealthStatus(0)).toBe(FundHealthStatus.DEPLETED);
    });
  });

  describe('updateFundHealth', () => {
    it('should emit alert when crossing below 20% threshold', async () => {
      mockFundRepo.findOne.mockResolvedValue({
        id: 1,
        balance: 15000,
        targetReserve: 100000,
        healthPercent: 25,
        tier: { tier: 'LOW' },
      });

      await service.updateFundHealth(1);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'fund.health.alert',
        expect.objectContaining({
          fundId: 1,
          healthPercent: 15,
        }),
      );
    });

    it('should not emit alert when already below threshold', async () => {
      mockFundRepo.findOne.mockResolvedValue({
        id: 1,
        balance: 10000,
        targetReserve: 100000,
        healthPercent: 10,
        tier: { tier: 'LOW' },
      });

      await service.updateFundHealth(1);

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('getDashboard', () => {
    it('should flag funds below threshold as alerts', async () => {
      mockFundRepo.find.mockResolvedValue([
        {
          id: 1,
          asset: 'USDT',
          balance: 10000,
          targetReserve: 100000,
          healthPercent: 10,
          healthStatus: FundHealthStatus.CRITICAL,
          tier: { tier: 'LOW' },
        },
        {
          id: 2,
          asset: 'USDT',
          balance: 80000,
          targetReserve: 100000,
          healthPercent: 80,
          healthStatus: FundHealthStatus.HEALTHY,
          tier: { tier: 'MEDIUM' },
        },
      ]);

      const dashboard = await service.getDashboard();

      expect(dashboard.activeAlerts).toBe(1);
      expect(dashboard.alerts[0].isBelowThreshold).toBe(true);
      expect(dashboard.alerts[0].healthPercent).toBeLessThan(
        HEALTH_WARNING_THRESHOLD,
      );
    });
  });
});
