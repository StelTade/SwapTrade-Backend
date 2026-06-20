import { AmmService } from './amm.service';

describe('AmmService', () => {
  let service: AmmService;

  beforeEach(() => {
    service = new AmmService();
  });

  describe('getAmountOut', () => {
    it('should calculate swap output using constant product formula', () => {
      const result = service.getAmountOut(100, 1000, 1000, 30);

      expect(result.amountOut).toBeGreaterThan(0);
      expect(result.amountOut).toBeLessThan(100);
      expect(result.feeAmount).toBeGreaterThan(0);
      expect(result.priceImpact).toBeGreaterThan(0);
    });

    it('should throw for zero or negative amount in', () => {
      expect(() => service.getAmountOut(0, 1000, 1000, 30)).toThrow();
      expect(() => service.getAmountOut(-10, 1000, 1000, 30)).toThrow();
    });

    it('should throw for insufficient liquidity', () => {
      expect(() => service.getAmountOut(100, 0, 1000, 30)).toThrow();
    });
  });

  describe('getSpotPrice', () => {
    it('should return reserveB / reserveA', () => {
      expect(service.getSpotPrice(1000, 2000)).toBe(2);
    });

    it('should return 0 when reserveA is zero', () => {
      expect(service.getSpotPrice(0, 2000)).toBe(0);
    });
  });

  describe('calculateLpTokensToMint', () => {
    it('should mint sqrt(amountA * amountB) for initial liquidity', () => {
      const result = service.calculateLpTokensToMint(100, 100, 0, 0, 0);
      expect(result.lpTokensMinted).toBe(100);
      expect(result.amountA).toBe(100);
      expect(result.amountB).toBe(100);
    });

    it('should mint proportional LP tokens for existing pool', () => {
      const result = service.calculateLpTokensToMint(
        100,
        200,
        1000,
        2000,
        1000,
      );
      expect(result.lpTokensMinted).toBe(100);
      expect(result.amountA).toBe(100);
      expect(result.amountB).toBe(200);
    });
  });

  describe('calculateWithdrawAmounts', () => {
    it('should return pro-rata share of reserves', () => {
      const result = service.calculateWithdrawAmounts(100, 1000, 1000, 2000);
      expect(result.amountA).toBe(100);
      expect(result.amountB).toBe(200);
    });

    it('should throw when LP amount exceeds supply', () => {
      expect(() =>
        service.calculateWithdrawAmounts(1500, 1000, 1000, 2000),
      ).toThrow();
    });
  });

  describe('distributeFees', () => {
    it('should distribute fees proportionally to LP share', () => {
      const share = service.distributeFees(10, 250, 1000);
      expect(share).toBe(2.5);
    });

    it('should return 0 when no LP supply', () => {
      expect(service.distributeFees(10, 100, 0)).toBe(0);
    });
  });

  describe('calculateImpermanentLoss', () => {
    it('should return zero IL when price unchanged', () => {
      const result = service.calculateImpermanentLoss(
        100,
        100,
        200,
        200,
        200,
        100,
      );
      expect(result.impermanentLossPercent).toBeCloseTo(0, 1);
    });

    it('should calculate positive IL when price diverges', () => {
      const result = service.calculateImpermanentLoss(
        100,
        100,
        300,
        100,
        200,
        100,
      );
      expect(result.impermanentLoss).toBeGreaterThan(0);
    });
  });
});
