import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolatilitySurfaceService } from './volatility-surface.service';
import { VolatilitySurface } from '../entities/volatility-surface.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { NotFoundException } from '@nestjs/common';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ ...data, id: data.id ?? 1 })),
  delete: jest.fn().mockResolvedValue({ affected: 0 }),
  createQueryBuilder: jest.fn().mockReturnValue({
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  }),
});

describe('VolatilitySurfaceService', () => {
  let service: VolatilitySurfaceService;
  let surfaceRepo: ReturnType<typeof mockRepo>;
  let assetRepo: ReturnType<typeof mockRepo>;

  const btcAsset = { id: 1, symbol: 'BTC' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolatilitySurfaceService,
        { provide: getRepositoryToken(VolatilitySurface), useFactory: mockRepo },
        { provide: getRepositoryToken(VirtualAsset), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(VolatilitySurfaceService);
    surfaceRepo = module.get(getRepositoryToken(VolatilitySurface));
    assetRepo = module.get(getRepositoryToken(VirtualAsset));
  });

  describe('updateVolatility', () => {
    it('should create new surface entry', async () => {
      assetRepo.findOne.mockResolvedValue(btcAsset);
      surfaceRepo.findOne.mockResolvedValue(null);

      const expiry = new Date('2026-12-31');
      const result = await service.updateVolatility({
        assetId: 1,
        strikePrice: 50000,
        expirationDate: expiry,
        impliedVolatility: 0.35,
        bidIv: 0.33,
        askIv: 0.37,
      });

      expect(result.impliedVolatility).toBe(0.35);
      expect(result.bidIv).toBe(0.33);
      expect(result.askIv).toBe(0.37);
      expect(result.sampleCount).toBe(1);
    });

    it('should update existing entry with EMA smoothing', async () => {
      assetRepo.findOne.mockResolvedValue(btcAsset);
      surfaceRepo.findOne.mockResolvedValue({
        id: 1,
        impliedVolatility: 0.3,
        sampleCount: 5,
        bidIv: 0.28,
        askIv: 0.32,
        lastTradedIv: null,
      });

      const result = await service.updateVolatility({
        assetId: 1,
        strikePrice: 50000,
        expirationDate: new Date('2026-12-31'),
        impliedVolatility: 0.4,
      });

      // EMA: 0.3 * 0.4 + 0.7 * 0.3 = 0.33
      expect(result.impliedVolatility).toBeCloseTo(0.33, 2);
      expect(result.sampleCount).toBe(6);
    });

    it('should throw when asset not found', async () => {
      assetRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateVolatility({
          assetId: 999,
          strikePrice: 50000,
          expirationDate: new Date(),
          impliedVolatility: 0.3,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVolatilitySurface', () => {
    it('should return surface data for an asset', async () => {
      assetRepo.findOne.mockResolvedValue(btcAsset);
      const entries = [
        { id: 1, strikePrice: 45000, impliedVolatility: 0.4 },
        { id: 2, strikePrice: 50000, impliedVolatility: 0.35 },
        { id: 3, strikePrice: 55000, impliedVolatility: 0.38 },
      ];
      surfaceRepo.find.mockResolvedValue(entries);

      const result = await service.getVolatilitySurface(1);
      expect(result).toEqual(entries);
    });

    it('should throw when asset not found', async () => {
      assetRepo.findOne.mockResolvedValue(null);

      await expect(service.getVolatilitySurface(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getInterpolatedVolatility', () => {
    it('should return exact match IV', async () => {
      const exact = { impliedVolatility: 0.35 };
      surfaceRepo.findOne.mockResolvedValue(exact);

      const iv = await service.getInterpolatedVolatility(
        1,
        50000,
        new Date('2026-12-31'),
      );
      expect(iv).toBe(0.35);
    });

    it('should return nearest-neighbor IV when no exact match', async () => {
      surfaceRepo.findOne.mockResolvedValue(null);
      surfaceRepo.find.mockResolvedValue([
        { strikePrice: 45000, expirationDate: new Date('2026-06-30'), impliedVolatility: 0.4 },
        { strikePrice: 50000, expirationDate: new Date('2026-12-31'), impliedVolatility: 0.35 },
        { strikePrice: 55000, expirationDate: new Date('2026-12-31'), impliedVolatility: 0.38 },
      ]);

      const iv = await service.getInterpolatedVolatility(
        1,
        51000,
        new Date('2026-12-31'),
      );
      expect(iv).toBe(0.35);
    });

    it('should throw when no surface data exists', async () => {
      surfaceRepo.findOne.mockResolvedValue(null);
      surfaceRepo.find.mockResolvedValue([]);

      await expect(
        service.getInterpolatedVolatility(1, 50000, new Date()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getIvByExpiration', () => {
    it('should return IV data for a specific expiration', async () => {
      const entries = [
        { strikePrice: 45000, impliedVolatility: 0.4, bidIv: 0.38, askIv: 0.42, lastTradedIv: 0.39, sampleCount: 10 },
        { strikePrice: 50000, impliedVolatility: 0.35, bidIv: 0.33, askIv: 0.37, lastTradedIv: 0.34, sampleCount: 15 },
      ];
      surfaceRepo.find.mockResolvedValue(entries);

      const result = await service.getIvByExpiration(1, new Date('2026-12-31'));
      expect(result).toHaveLength(2);
      expect(result[0].strikePrice).toBe(45000);
    });
  });

  describe('getTermStructure', () => {
    it('should return term structure for a strike', async () => {
      const entries = [
        { expirationDate: new Date('2026-06-30'), impliedVolatility: 0.3 },
        { expirationDate: new Date('2026-12-31'), impliedVolatility: 0.35 },
      ];
      surfaceRepo.find.mockResolvedValue(entries);

      const result = await service.getTermStructure(1, 50000);
      expect(result).toHaveLength(2);
      expect(result[0].iv).toBe(0.3);
    });
  });

  describe('getSkew', () => {
    it('should return skew for an expiration', async () => {
      const entries = [
        { strikePrice: 40000, impliedVolatility: 0.5 },
        { strikePrice: 50000, impliedVolatility: 0.35 },
        { strikePrice: 60000, impliedVolatility: 0.3 },
      ];
      surfaceRepo.find.mockResolvedValue(entries);

      const result = await service.getSkew(1, new Date('2026-12-31'));
      expect(result).toHaveLength(3);
      expect(result[0].strike).toBe(40000);
      expect(result[0].iv).toBe(0.5); // Volatility smile/skew
    });
  });

  describe('cleanupOldData', () => {
    it('should delete old surface data', async () => {
      const result = await service.cleanupOldData(365);
      expect(result).toBe(0);
    });
  });
});
