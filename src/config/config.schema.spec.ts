// src/config/config.schema.spec.ts
import { configSchema } from './config.schema';

describe('ConfigSchema', () => {
  describe('Validation', () => {
    it('should validate valid configuration', () => {
      const validConfig = {
        NODE_ENV: 'development',
        PORT: 3000,
        DB_NAME: 'test.db',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        JWT_SECRET: 'test-secret',
        CACHE_ENABLED: true,
        LOG_LEVEL: 'info',
      };

      const { error } = configSchema.validate(validConfig);
      expect(error).toBeUndefined();
    });

    it('should reject invalid NODE_ENV', () => {
      const invalidConfig = {
        NODE_ENV: 'invalid-env',
        PORT: 3000,
        DB_NAME: 'test.db',
        JWT_SECRET: 'test-secret',
      };

      const { error } = configSchema.validate(invalidConfig);
      expect(error).toBeDefined();
      expect(error?.details[0].path).toContain('NODE_ENV');
    });

    it('should reject invalid PORT', () => {
      const invalidConfig = {
        NODE_ENV: 'development',
        PORT: 99999, // Invalid port
        DB_NAME: 'test.db',
        JWT_SECRET: 'test-secret',
      };

      const { error } = configSchema.validate(invalidConfig);
      expect(error).toBeDefined();
    });

    it('should require JWT_SECRET', () => {
      const invalidConfig = {
        NODE_ENV: 'development',
        PORT: 3000,
        DB_NAME: 'test.db',
        // Missing JWT_SECRET
      };

      const { error } = configSchema.validate(invalidConfig);
      expect(error).toBeDefined();
      expect(error?.details.some(detail => detail.path.includes('JWT_SECRET'))).toBe(true);
    });

    it('should validate feature flags', () => {
      const configWithFeatures = {
        NODE_ENV: 'development',
        PORT: 3000,
        DB_NAME: 'test.db',
        JWT_SECRET: 'test-secret',
        FEATURE_ADVANCED_CACHING: true,
        FEATURE_HOT_RELOAD: false,
        FEATURE_AB_TESTING: true,
      };

      const { error } = configSchema.validate(configWithFeatures);
      expect(error).toBeUndefined();
    });

    it('should validate cache configuration', () => {
      const configWithCache = {
        NODE_ENV: 'development',
        PORT: 3000,
        DB_NAME: 'test.db',
        JWT_SECRET: 'test-secret',
        CACHE_ENABLED: true,
        CACHE_TTL: 300,
        CACHE_TTL_USER_BALANCES: 30,
        CACHE_WARMING_ENABLED: true,
        CACHE_WARMING_TIMEOUT: 30000,
      };

      const { error } = configSchema.validate(configWithCache);
      expect(error).toBeUndefined();
    });

    it('should validate rate limiting configuration', () => {
      const configWithRateLimit = {
        NODE_ENV: 'development',
        PORT: 3000,
        DB_NAME: 'test.db',
        JWT_SECRET: 'test-secret',
        RATE_LIMIT_WINDOW_MS: 900000,
        RATE_LIMIT_MAX_REQUESTS: 100,
        RATE_LIMIT_STANDARD_HEADERS: true,
      };

      const { error } = configSchema.validate(configWithRateLimit);
      expect(error).toBeUndefined();
    });
  });

  describe('Defaults', () => {
    it('should apply default values', () => {
      const minimalConfig = {
        DB_NAME: 'test.db',
        JWT_SECRET: 'test-secret',
      };

      const { value, error } = configSchema.validate(minimalConfig);
      expect(error).toBeUndefined();
      expect(value.NODE_ENV).toBe('development');
      expect(value.PORT).toBe(3000);
      expect(value.CACHE_ENABLED).toBe(true);
    });
  });
});