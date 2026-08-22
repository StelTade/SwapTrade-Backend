import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OptionCollateralService } from './option-collateral.service';
import { BlackScholesService } from './black-scholes.service';
import { OptionCollateral } from '../entities/option-collateral.entity';
import { OptionContract } from '../entities/option-contract.entity';
import { CollateralStatus } from '../enums/collateral-status.enum';
import { NotFoundException } from '@nestjs/common';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ ...data, id: data.id ?? 1 })),
});

describe('OptionCollateralService', () => {
  let service: OptionCollateralService;
  let collateralRepo: ReturnType<typeof mockRepo>;
  let contractRepo: ReturnType<typeof mockRepo>;

  const contract = {
    id: 1,
    strikePrice: 55000,
    contractSize: 1,
    totalSupply: 100,
    openInterest: 50,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionCollateralService,
        BlackScholesService,
        { provide: getRepositoryToken(OptionCollateral), useFactory: mockRepo },
        { provide: getRepositoryToken(OptionContract), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(OptionCollateralService);
    collateralRepo = module.get(getRepositoryToken(OptionCollateral));
    contractRepo = module.get(getRepositoryToken(OptionContract));
  });

  describe('lockCollateral', () => {
    it('should lock collateral for a writer', async () => {
      contractRepo.findOne.mockResolvedValue(contract);
      collateralRepo.findOne.mockResolvedValue(null);

      const result = await service.lockCollateral(1, 1, 5, 1);

      expect(result.lockedAmount).toBe(275000); // 55000 * 1 * 5
      expect(result.remainingAmount).toBe(275000);
      expect(result.coveredContracts).toBe(5);
      expect(result.status).toBe(CollateralStatus.LOCKED);
    });

    it('should increase existing collateral lock', async () => {
      contractRepo.findOne.mockResolvedValue(contract);
      const existing = {
        userId: 1,
        contractId: 1,
        lockedAmount: 110000,
        remainingAmount: 110000,
        coveredContracts: 2,
        status: CollateralStatus.LOCKED,
      };
      collateralRepo.findOne.mockResolvedValue(existing);

      const result = await service.lockCollateral(1, 1, 3, 1);

      expect(result.lockedAmount).toBe(385000); // 110000 + 165000
      expect(result.coveredContracts).toBe(5);
    });

    it('should throw NotFoundException for missing contract', async () => {
      contractRepo.findOne.mockResolvedValue(null);

      await expect(
        service.lockCollateral(1, 999, 5, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('releaseCollateral', () => {
    it('should release collateral', async () => {
      collateralRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        contractId: 1,
        lockedAmount: 275000,
        remainingAmount: 275000,
        coveredContracts: 5,
        status: CollateralStatus.LOCKED,
      });
      contractRepo.findOne.mockResolvedValue(contract);

      const result = await service.releaseCollateral(1, 1, 5);

      expect(result.remainingAmount).toBe(0);
      expect(result.coveredContracts).toBe(0);
      expect(result.status).toBe(CollateralStatus.RELEASED);
      expect(result.releasedAt).toBeDefined();
    });

    it('should partially release collateral', async () => {
      collateralRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        contractId: 1,
        lockedAmount: 275000,
        remainingAmount: 275000,
        coveredContracts: 5,
        status: CollateralStatus.LOCKED,
      });
      contractRepo.findOne.mockResolvedValue(contract);

      const result = await service.releaseCollateral(1, 1, 2);

      expect(result.remainingAmount).toBe(165000);
      expect(result.coveredContracts).toBe(3);
      expect(result.status).toBe(CollateralStatus.PARTIALLY_RELEASED);
    });

    it('should throw NotFoundException when no locked collateral', async () => {
      collateralRepo.findOne.mockResolvedValue(null);

      await expect(service.releaseCollateral(1, 1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('liquidateCollateral', () => {
    it('should liquidate collateral', async () => {
      collateralRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        contractId: 1,
        lockedAmount: 275000,
        remainingAmount: 275000,
        coveredContracts: 5,
        status: CollateralStatus.LOCKED,
      });

      const result = await service.liquidateCollateral(1, 1);

      expect(result.status).toBe(CollateralStatus.LIQUIDATED);
      expect(result.remainingAmount).toBe(0);
      expect(result.coveredContracts).toBe(0);
    });

    it('should throw NotFoundException when no locked collateral', async () => {
      collateralRepo.findOne.mockResolvedValue(null);

      await expect(service.liquidateCollateral(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserCollateral', () => {
    it('should return user collateral entries', async () => {
      const collaterals = [{ id: 1, userId: 1 }, { id: 2, userId: 1 }];
      collateralRepo.find.mockResolvedValue(collaterals);

      const result = await service.getUserCollateral(1);
      expect(result).toEqual(collaterals);
    });
  });

  describe('calculateRequiredCollateral', () => {
    it('should calculate collateral as strike * size * quantity', () => {
      const required = service.calculateRequiredCollateral(contract as any, 10);
      expect(required).toBe(550000); // 55000 * 1 * 10
    });
  });

  describe('validateCollateralCoverage', () => {
    it('should validate sufficient collateral', async () => {
      contractRepo.findOne.mockResolvedValue(contract);
      collateralRepo.find.mockResolvedValue([
        { remainingAmount: 2750000 },
      ]);

      const result = await service.validateCollateralCoverage(1);
      expect(result.covered).toBe(true);
      expect(result.totalCollateral).toBe(2750000);
    });

    it('should detect insufficient collateral', async () => {
      contractRepo.findOne.mockResolvedValue({
        ...contract,
        totalSupply: 100,
        openInterest: 0, // All written
      });
      collateralRepo.find.mockResolvedValue([
        { remainingAmount: 1000000 },
      ]);

      const result = await service.validateCollateralCoverage(1);
      // Required: 55000 * 1 * 100 = 5500000
      expect(result.covered).toBe(false);
    });

    it('should throw for missing contract', async () => {
      contractRepo.findOne.mockResolvedValue(null);

      await expect(service.validateCollateralCoverage(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
