import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OptionContractService } from './option-contract.service';
import { BlackScholesService } from './black-scholes.service';
import { OptionContract } from '../entities/option-contract.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { OptionStatus } from '../enums/option-status.enum';
import { OptionType } from '../enums/option-type.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ ...data, id: data.id ?? 1 })),
 createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

describe('OptionContractService', () => {
  let service: OptionContractService;
  let contractRepo: ReturnType<typeof mockRepo>;
  let assetRepo: ReturnType<typeof mockRepo>;

  const btcAsset = { id: 1, symbol: 'BTC', name: 'Bitcoin', price: 50000 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionContractService,
        BlackScholesService,
        { provide: getRepositoryToken(OptionContract), useFactory: mockRepo },
        { provide: getRepositoryToken(VirtualAsset), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(OptionContractService);
    contractRepo = module.get(getRepositoryToken(OptionContract));
    assetRepo = module.get(getRepositoryToken(VirtualAsset));
  });

  describe('createContract', () => {
    it('should create a call option contract', async () => {
      assetRepo.findOne.mockResolvedValue(btcAsset);

      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 3);

      const result = await service.createContract({
        optionType: OptionType.CALL,
        underlyingAssetId: 1,
        strikePrice: 55000,
        contractSize: 1,
        expirationDate: futureDate.toISOString(),
        impliedVolatility: 0.3,
        riskFreeRate: 0.05,
        totalSupply: 100,
      });

      expect(result.optionType).toBe(OptionType.CALL);
      expect(result.strikePrice).toBe(55000);
      expect(result.totalSupply).toBe(100);
      expect(result.status).toBe(OptionStatus.ACTIVE);
      expect(result.premium).toBeGreaterThan(0);
      expect(contractRepo.save).toHaveBeenCalled();
    });

    it('should create a put option contract', async () => {
      assetRepo.findOne.mockResolvedValue(btcAsset);

      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      const result = await service.createContract({
        optionType: OptionType.PUT,
        underlyingAssetId: 1,
        strikePrice: 45000,
        contractSize: 1,
        expirationDate: futureDate.toISOString(),
      });

      expect(result.optionType).toBe(OptionType.PUT);
      expect(result.strikePrice).toBe(45000);
      expect(result.premium).toBeGreaterThan(0);
    });

    it('should reject when underlying asset not found', async () => {
      assetRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createContract({
          optionType: OptionType.CALL,
          underlyingAssetId: 999,
          strikePrice: 55000,
          contractSize: 1,
          expirationDate: new Date(Date.now() + 86400000).toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject past expiration date', async () => {
      assetRepo.findOne.mockResolvedValue(btcAsset);

      await expect(
        service.createContract({
          optionType: OptionType.CALL,
          underlyingAssetId: 1,
          strikePrice: 55000,
          contractSize: 1,
          expirationDate: new Date('2020-01-01').toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject strike price outside reasonable bounds', async () => {
      assetRepo.findOne.mockResolvedValue(btcAsset);

      // Strike is 100x the underlying (> 1000%)
      await expect(
        service.createContract({
          optionType: OptionType.CALL,
          underlyingAssetId: 1,
          strikePrice: 5000000,
          contractSize: 1,
          expirationDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject zero strike price', async () => {
      assetRepo.findOne.mockResolvedValue(btcAsset);

      await expect(
        service.createContract({
          optionType: OptionType.CALL,
          underlyingAssetId: 1,
          strikePrice: 0,
          contractSize: 1,
          expirationDate: new Date(Date.now() + 86400000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getContract', () => {
    it('should return a contract by id', async () => {
      const contract = { id: 1, optionType: OptionType.CALL, status: OptionStatus.ACTIVE };
      contractRepo.findOne.mockResolvedValue(contract);

      const result = await service.getContract(1);
      expect(result).toBe(contract);
    });

    it('should throw NotFoundException for missing contract', async () => {
      contractRepo.findOne.mockResolvedValue(null);

      await expect(service.getContract(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listContracts', () => {
    it('should list all contracts', async () => {
      const contracts = [{ id: 1 }, { id: 2 }];
      contractRepo.find.mockResolvedValue(contracts);

      const result = await service.listContracts();
      expect(result).toEqual(contracts);
    });

    it('should filter by optionType', async () => {
      contractRepo.find.mockResolvedValue([]);

      await service.listContracts({ optionType: OptionType.CALL });
      expect(contractRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ optionType: OptionType.CALL }),
        }),
      );
    });
  });

  describe('recalculatePrice', () => {
    it('should update pricing and Greeks', async () => {
      const contract = {
        id: 1,
        status: OptionStatus.ACTIVE,
        strikePrice: 50000,
        riskFreeRate: 0.05,
        impliedVolatility: 0.3,
        optionType: OptionType.CALL,
        expirationDate: new Date(Date.now() + 86400000 * 30),
      };
      contractRepo.findOne.mockResolvedValue(contract);

      const result = await service.recalculatePrice(1, 52000);
      expect(result.premium).toBeGreaterThan(0);
      expect(result.delta).toBeDefined();
      expect(contractRepo.save).toHaveBeenCalled();
    });

    it('should reject recalculating non-active contract', async () => {
      const contract = {
        id: 1,
        status: OptionStatus.EXPIRED,
        strikePrice: 50000,
        riskFreeRate: 0.05,
        impliedVolatility: 0.3,
        optionType: OptionType.CALL,
        expirationDate: new Date(Date.now() + 86400000 * 30),
      };
      contractRepo.findOne.mockResolvedValue(contract);

      await expect(service.recalculatePrice(1, 52000)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('expireContract', () => {
    it('should set contract status to EXPIRED', async () => {
      const contract = {
        id: 1,
        status: OptionStatus.ACTIVE,
        openInterest: 50,
      };
      contractRepo.findOne.mockResolvedValue(contract);

      const result = await service.expireContract(1);
      expect(result.status).toBe(OptionStatus.EXPIRED);
      expect(result.openInterest).toBe(0);
    });
  });
});
