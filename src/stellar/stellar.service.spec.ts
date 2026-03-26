import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarService } from './stellar.service';

// Mock stellar-sdk
jest.mock('stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: jest.fn(),
      transactions: jest.fn().mockReturnThis(),
      ledgers: jest.fn().mockReturnThis(),
      root: jest.fn(),
      forAccount: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      call: jest.fn(),
    })),
  },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
  Asset: jest.fn(),
}));

describe('StellarService', () => {
  let service: StellarService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
          STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
          STELLAR_USDC_ISSUER: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();
      
      expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
      expect(config.usdcConfigured).toBe(true);
      expect(config.usdcIssuer).toBeDefined();
    });
  });

  describe('isReady', () => {
    it('should return initialization status', () => {
      const ready = service.isReady();
      expect(typeof ready).toBe('boolean');
    });
  });

  describe('getUSDAsset', () => {
    it('should return USDC asset when configured', () => {
      const asset = service.getUSDAsset();
      expect(asset).toBeDefined();
    });
  });

  describe('getNetworkPassphrase', () => {
    it('should return network passphrase', () => {
      const passphrase = service.getNetworkPassphrase();
      expect(passphrase).toBeDefined();
      expect(typeof passphrase).toBe('string');
    });
  });

  describe('getServer', () => {
    it('should return Horizon server instance', () => {
      const server = service.getServer();
      expect(server).toBeDefined();
    });
  });
});
