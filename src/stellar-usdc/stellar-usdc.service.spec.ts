import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarUsdcService } from './stellar-usdc.service';

// Mock stellar-sdk
jest.mock('stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: jest.fn(),
      root: jest.fn(),
    })),
  },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
  Asset: jest.fn().mockImplementation((code, issuer) => ({ code, issuer })),
  StrKey: {
    decodeEd25519PublicKey: jest.fn((key) => {
      if (key.length !== 56) throw new Error('Invalid key');
      return Buffer.from('mock');
    }),
  },
}));

describe('StellarUsdcService', () => {
  let service: StellarUsdcService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
          STELLAR_USDC_ISSUER: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarUsdcService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StellarUsdcService>(StellarUsdcService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isUsdcConfigured', () => {
    it('should return true when USDC issuer is configured', () => {
      expect(service.isUsdcConfigured()).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return USDC configuration', () => {
      const config = service.getConfig();
      
      expect(config.assetCode).toBe('USDC');
      expect(config.isConfigured).toBe(true);
      expect(config.issuer).toBeDefined();
    });
  });

  describe('isValidPublicKey', () => {
    it('should validate a 56-character public key', () => {
      const validKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      expect(service.isValidPublicKey(validKey)).toBe(true);
    });
  });

  describe('getIssuer', () => {
    it('should return the USDC issuer', () => {
      const issuer = service.getIssuer();
      expect(issuer).toBe('GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
    });
  });

  describe('getUSDAsset', () => {
    it('should return the USDC asset', () => {
      const asset = service.getUSDAsset();
      expect(asset).toBeDefined();
    });
  });
});
