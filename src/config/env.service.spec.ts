import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EnvService } from './env.service';

describe('EnvService', () => {
  let service: EnvService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Set up environment for testing
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';

    mockConfigService = {
      get: jest.fn((key: string) => process.env[key]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EnvService>(EnvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return NODE_ENV', () => {
      const env = service.get('NODE_ENV');
      expect(env).toBe('test');
    });

    it('should return PORT', () => {
      const port = service.get('PORT');
      expect(port).toBe(3000);
    });
  });

  describe('isProduction', () => {
    it('should return false for test environment', () => {
      expect(service.isProduction()).toBe(false);
    });
  });

  describe('isDevelopment', () => {
    it('should return false for test environment', () => {
      expect(service.isDevelopment()).toBe(false);
    });
  });

  describe('isEmailConfigured', () => {
    it('should return false when email is not configured', () => {
      expect(service.isEmailConfigured()).toBe(false);
    });
  });

  describe('isStellarConfigured', () => {
    it('should return false when USDC issuer is not configured', () => {
      expect(service.isStellarConfigured()).toBe(false);
    });
  });
});
