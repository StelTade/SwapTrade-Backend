import { BlackScholesService } from './black-scholes.service';
import { OptionType } from '../enums/option-type.enum';

describe('BlackScholesService', () => {
  let service: BlackScholesService;

  beforeEach(() => {
    service = new BlackScholesService();
  });

  describe('calculate', () => {
    it('should calculate call option price correctly', () => {
      const result = service.calculate(
        100, // spot
        100, // strike (ATM)
        1,   // 1 year to expiry
        0.05, // 5% risk-free
        0.2,  // 20% vol
        OptionType.CALL,
      );

      expect(result.price).toBeGreaterThan(0);
      expect(result.price).toBeCloseTo(10.45, 0); // ~10.45 for ATM call
      expect(result.delta).toBeGreaterThan(0.55);
      expect(result.delta).toBeLessThan(0.75);
      expect(result.gamma).toBeGreaterThan(0);
      expect(result.vega).toBeGreaterThan(0);
      expect(result.theta).toBeLessThan(0); // Time decay is negative for long options
    });

    it('should calculate put option price correctly', () => {
      const result = service.calculate(
        100, // spot
        100, // strike (ATM)
        1,   // 1 year
        0.05,
        0.2,
        OptionType.PUT,
      );

      expect(result.price).toBeGreaterThan(0);
      expect(result.price).toBeCloseTo(5.57, 0); // ~5.57 for ATM put
      expect(result.delta).toBeLessThan(-0.25);
      expect(result.delta).toBeGreaterThan(-0.45);
    });

    it('should calculate ITM call with higher premium than ATM', () => {
      const atmCall = service.calculate(100, 100, 1, 0.05, 0.2, OptionType.CALL);
      const itmCall = service.calculate(110, 100, 1, 0.05, 0.2, OptionType.CALL);

      expect(itmCall.price).toBeGreaterThan(atmCall.price);
    });

    it('should calculate OTM call with lower premium than ATM', () => {
      const atmCall = service.calculate(100, 100, 1, 0.05, 0.2, OptionType.CALL);
      const otmCall = service.calculate(90, 100, 1, 0.05, 0.2, OptionType.CALL);

      expect(otmCall.price).toBeLessThan(atmCall.price);
    });

    it('should handle deep ITM options approaching intrinsic value', () => {
      const result = service.calculate(
        150, // spot (deep ITM call)
        100, // strike
        0.01, // very short time
        0.05,
        0.2,
        OptionType.CALL,
      );

      // Deep ITM, short expiry -> price approaches intrinsic value
      expect(result.price).toBeGreaterThanOrEqual(49);
      expect(result.price).toBeLessThanOrEqual(51);
    });

    it('should handle zero time to expiry (intrinsic value only)', () => {
      const itmCall = service.calculate(110, 100, 0, 0.05, 0.2, OptionType.CALL);
      expect(itmCall.price).toBe(10); // intrinsic value = 110 - 100

      const otmCall = service.calculate(90, 100, 0, 0.05, 0.2, OptionType.CALL);
      expect(otmCall.price).toBe(0); // out of the money

      const itmPut = service.calculate(90, 100, 0, 0.05, 0.2, OptionType.PUT);
      expect(itmPut.price).toBe(10); // intrinsic value = 100 - 90

      const otmPut = service.calculate(110, 100, 0, 0.05, 0.2, OptionType.PUT);
      expect(otmPut.price).toBe(0);
    });

    it('should handle zero volatility gracefully', () => {
      const result = service.calculate(100, 100, 1, 0.05, 0, OptionType.CALL);
      expect(result.price).toBeGreaterThanOrEqual(0);
      expect(result.gamma).toBe(0);
      expect(result.vega).toBe(0);
    });

    it('should have call-put parity: C - P = S - K*exp(-rT)', () => {
      const S = 100;
      const K = 100;
      const T = 1;
      const r = 0.05;
      const sigma = 0.2;

      const call = service.calculate(S, K, T, r, sigma, OptionType.CALL);
      const put = service.calculate(S, K, T, r, sigma, OptionType.PUT);

      const parity = call.price - put.price;
      const expected = S - K * Math.exp(-r * T);

      expect(parity).toBeCloseTo(expected, 1);
    });

    it('should have positive gamma for both calls and puts', () => {
      const callGamma = service.calculate(100, 100, 1, 0.05, 0.2, OptionType.CALL).gamma;
      const putGamma = service.calculate(100, 100, 1, 0.05, 0.2, OptionType.PUT).gamma;

      expect(callGamma).toBeGreaterThan(0);
      expect(putGamma).toBeGreaterThan(0);
      // Gamma should be the same for calls and puts
      expect(callGamma).toBeCloseTo(putGamma, 8);
    });

    it('should round all results to 8 decimal places', () => {
      const result = service.calculate(
        123.456,
        100.789,
        0.5,
        0.03,
        0.25,
        OptionType.CALL,
      );

      const decimals = (val: number) => {
        const str = val.toString();
        const dotIndex = str.indexOf('.');
        return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
      };

      expect(decimals(result.price)).toBeLessThanOrEqual(8);
      expect(decimals(result.delta)).toBeLessThanOrEqual(8);
      expect(decimals(result.gamma)).toBeLessThanOrEqual(8);
      expect(decimals(result.vega)).toBeLessThanOrEqual(8);
      expect(decimals(result.theta)).toBeLessThanOrEqual(8);
      expect(decimals(result.rho)).toBeLessThanOrEqual(8);
    });
  });

  describe('calculateTimeToExpiry', () => {
    it('should calculate positive time for future date', () => {
      const now = new Date('2026-01-01');
      const expiry = new Date('2027-01-01');

      const tte = service.calculateTimeToExpiry(expiry, now);
      expect(tte).toBeCloseTo(1, 1); // ~1 year
    });

    it('should return 0 for past dates', () => {
      const now = new Date('2026-01-01');
      const expiry = new Date('2025-01-01');

      const tte = service.calculateTimeToExpiry(expiry, now);
      expect(tte).toBe(0);
    });

    it('should calculate correct fraction for 6 months', () => {
      const now = new Date('2026-01-01');
      const expiry = new Date('2026-07-01');

      const tte = service.calculateTimeToExpiry(expiry, now);
      expect(tte).toBeCloseTo(0.5, 1);
    });
  });

  describe('isInTheMoney', () => {
    it('should identify ITM call when spot > strike', () => {
      expect(service.isInTheMoney(110, 100, OptionType.CALL)).toBe(true);
    });

    it('should identify OTM call when spot <= strike', () => {
      expect(service.isInTheMoney(90, 100, OptionType.CALL)).toBe(false);
      expect(service.isInTheMoney(100, 100, OptionType.CALL)).toBe(false);
    });

    it('should identify ITM put when spot < strike', () => {
      expect(service.isInTheMoney(90, 100, OptionType.PUT)).toBe(true);
    });

    it('should identify OTM put when spot >= strike', () => {
      expect(service.isInTheMoney(110, 100, OptionType.PUT)).toBe(false);
      expect(service.isInTheMoney(100, 100, OptionType.PUT)).toBe(false);
    });
  });

  describe('round8', () => {
    it('should round to 8 decimal places', () => {
      expect(service.round8(1.123456789)).toBe(1.12345679);
      expect(service.round8(0.123456789)).toBe(0.12345679);
      expect(service.round8(100.1)).toBe(100.1);
    });
  });
});
