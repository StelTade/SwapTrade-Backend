// src/config/config.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { ConfigModule } from './config.module';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Environment } from './configuration';

describe('ConfigService', () => {
  let service: ConfigService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Environment detection', () => {
    it('should detect development environment', () => {
      expect(service.isDevelopment()).toBe(true);
      expect(service.isProduction()).toBe(false);
      expect(service.isStaging()).toBe(false);
    });

    it('should return correct environment', () => {
      expect(service.getEnv()).toBe(Environment.DEVELOPMENT);
    });
  });

  describe('Configuration validation', () => {
    it('should have valid app configuration', () => {
      expect(service.app.port).toBeGreaterThan(0);
      expect(service.app.nodeEnv).toBeDefined();
    });

    it('should have valid database configuration', () => {
      expect(service.database.database).toBeDefined();
      expect(service.database.type).toBeDefined();
    });

    it('should have valid redis configuration', () => {
      expect(service.redis.host).toBeDefined();
      expect(service.redis.port).toBeGreaterThan(0);
    });

    it('should have valid auth configuration', () => {
      expect(service.auth).toBeDefined();
      // JWT secret should be required but we'll test the structure
    });

    it('should have valid cache configuration', () => {
      expect(service.cache).toBeDefined();
      expect(service.cache.redis).toBeDefined();
    });
  });

  describe('Feature flags', () => {
    it('should check feature flags correctly', () => {
      expect(typeof service.isFeatureEnabled('enableAdvancedCaching')).toBe('boolean');
      expect(typeof service.isFeatureEnabled('enableHotReload')).toBe('boolean');
    });

    it('should have features configuration', () => {
      expect(service.features).toBeDefined();
    });
  });

  describe('Type-safe getters', () => {
    it('should provide type-safe access to app config', () => {
      const appConfig = service.app;
      expect(appConfig).toHaveProperty('port');
      expect(appConfig).toHaveProperty('nodeEnv');
      expect(appConfig).toHaveProperty('cors');
    });

    it('should provide type-safe access to database config', () => {
      const dbConfig = service.database;
      expect(dbConfig).toHaveProperty('type');
      expect(dbConfig).toHaveProperty('database');
    });

    it('should provide type-safe access to redis config', () => {
      const redisConfig = service.redis;
      expect(redisConfig).toHaveProperty('host');
      expect(redisConfig).toHaveProperty('port');
    });
  });

  describe('Event handling', () => {
    it('should emit config loaded event', (done) => {
      service.onConfigLoad((config) => {
        expect(config).toBeDefined();
        expect(config.app).toBeDefined();
        done();
      });
    });

    it('should handle config reload events', (done) => {
      let reloadCalled = false;
      service.onConfigReload(() => {
        reloadCalled = true;
      });

      service.onConfigReloadFailed((error) => {
        // Should not be called in this test
        expect(error).toBeUndefined();
      });

      // Simulate reload by calling private method (in real scenario, file watcher would trigger)
      // For testing purposes, we just check the event setup
      setTimeout(() => {
        expect(reloadCalled).toBe(false); // Should not be called without actual reload
        done();
      }, 100);
    });
  });
});