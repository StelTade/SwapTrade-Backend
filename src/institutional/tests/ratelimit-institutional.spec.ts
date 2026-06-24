import {
  RATE_LIMIT_CONFIG,
  ENDPOINT_RATE_LIMIT_MAP,
  USER_ROLE_MULTIPLIERS,
} from '../../ratelimit/ratelimit.config';

describe('Rate Limit Configuration - Institutional', () => {
  describe('INSTITUTIONAL_BULK_TRADE rate limit', () => {
    it('should support 1000+ trades per second', () => {
      expect(RATE_LIMIT_CONFIG.INSTITUTIONAL_BULK_TRADE).toBeDefined();
      expect(
        RATE_LIMIT_CONFIG.INSTITUTIONAL_BULK_TRADE.limit,
      ).toBeGreaterThanOrEqual(1000);
      expect(RATE_LIMIT_CONFIG.INSTITUTIONAL_BULK_TRADE.windowMs).toBe(1000); // 1 second
    });

    it('should have a name', () => {
      expect(RATE_LIMIT_CONFIG.INSTITUTIONAL_BULK_TRADE.name).toBe(
        'institutional_bulk_trade',
      );
    });
  });

  describe('INSTITUTIONAL_API rate limit', () => {
    it('should support 5000+ requests per second', () => {
      expect(RATE_LIMIT_CONFIG.INSTITUTIONAL_API).toBeDefined();
      expect(RATE_LIMIT_CONFIG.INSTITUTIONAL_API.limit).toBeGreaterThanOrEqual(
        5000,
      );
      expect(RATE_LIMIT_CONFIG.INSTITUTIONAL_API.windowMs).toBe(1000);
    });
  });

  describe('INSTITUTIONAL_REPORTING rate limit', () => {
    it('should be defined', () => {
      expect(RATE_LIMIT_CONFIG.INSTITUTIONAL_REPORTING).toBeDefined();
      expect(RATE_LIMIT_CONFIG.INSTITUTIONAL_REPORTING.limit).toBe(100);
      expect(RATE_LIMIT_CONFIG.INSTITUTIONAL_REPORTING.windowMs).toBe(60000);
    });
  });

  describe('Endpoint mappings', () => {
    it('should map institutional bulk trade endpoint', () => {
      expect(
        ENDPOINT_RATE_LIMIT_MAP['/institutional/bulk-trade'],
      ).toBeDefined();
      expect(ENDPOINT_RATE_LIMIT_MAP['/institutional/bulk-trade'].name).toBe(
        'institutional_bulk_trade',
      );
    });

    it('should map institutional trades bulk endpoint', () => {
      expect(
        ENDPOINT_RATE_LIMIT_MAP['/institutional/trades/bulk'],
      ).toBeDefined();
    });

    it('should map institutional reports endpoint', () => {
      expect(ENDPOINT_RATE_LIMIT_MAP['/institutional/reports']).toBeDefined();
      expect(ENDPOINT_RATE_LIMIT_MAP['/institutional/reports'].name).toBe(
        'institutional_reporting',
      );
    });

    it('should map institutional reconciliation endpoint', () => {
      expect(
        ENDPOINT_RATE_LIMIT_MAP['/institutional/reconciliation'],
      ).toBeDefined();
    });
  });

  describe('User role multipliers', () => {
    it('should have INSTITUTIONAL_CLIENT multiplier', () => {
      expect(USER_ROLE_MULTIPLIERS.INSTITUTIONAL_CLIENT).toBeDefined();
      expect(USER_ROLE_MULTIPLIERS.INSTITUTIONAL_CLIENT).toBe(10);
    });

    it('should have highest multiplier for institutional clients', () => {
      expect(USER_ROLE_MULTIPLIERS.INSTITUTIONAL_CLIENT).toBeGreaterThan(
        USER_ROLE_MULTIPLIERS.ADMIN,
      );
    });
  });
});
