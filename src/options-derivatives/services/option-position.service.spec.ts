import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OptionPositionService } from './option-position.service';
import { BlackScholesService } from './black-scholes.service';
import { OptionPosition } from '../entities/option-position.entity';
import { OptionContract } from '../entities/option-contract.entity';
import { OptionStatus } from '../enums/option-status.enum';
import { OptionType } from '../enums/option-type.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ ...data, id: data.id ?? 1 })),
});

describe('OptionPositionService', () => {
  let service: OptionPositionService;
  let positionRepo: ReturnType<typeof mockRepo>;
  let contractRepo: ReturnType<typeof mockRepo>;

  const activeContract = {
    id: 1,
    optionType: OptionType.CALL,
    strikePrice: 55000,
    premium: 2500,
    contractSize: 1,
    openInterest: 100,
    status: OptionStatus.ACTIVE,
    expirationDate: new Date(Date.now() + 86400000 * 30),
    riskFreeRate: 0.05,
    impliedVolatility: 0.3,
    underlyingPriceAtCreation: 50000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionPositionService,
        BlackScholesService,
        { provide: getRepositoryToken(OptionPosition), useFactory: mockRepo },
        { provide: getRepositoryToken(OptionContract), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(OptionPositionService);
    positionRepo = module.get(getRepositoryToken(OptionPosition));
    contractRepo = module.get(getRepositoryToken(OptionContract));
  });

  describe('buyOption', () => {
    it('should create a new buyer position', async () => {
      contractRepo.findOne.mockResolvedValue(activeContract);
      positionRepo.findOne.mockResolvedValue(null);

      const result = await service.buyOption({
        contractId: 1,
        userId: 1,
        quantity: 5,
      });

      expect(result.userId).toBe(1);
      expect(result.contractId).toBe(1);
      expect(result.isWriter).toBe(false);
      expect(result.quantity).toBe(5);
      expect(result.totalPremium).toBe(12500); // 2500 * 5
    });

    it('should increase existing buyer position', async () => {
      contractRepo.findOne.mockResolvedValue(activeContract);
      const existingPosition = {
        userId: 1,
        contractId: 1,
        isWriter: false,
        quantity: 3,
        averagePremium: 2500,
        totalPremium: 7500,
      };
      positionRepo.findOne.mockResolvedValue(existingPosition);

      const result = await service.buyOption({
        contractId: 1,
        userId: 1,
        quantity: 2,
      });

      expect(result.quantity).toBe(5);
      expect(result.totalPremium).toBe(12500);
    });

    it('should decrease open interest', async () => {
      contractRepo.findOne.mockResolvedValue({ ...activeContract });
      positionRepo.findOne.mockResolvedValue(null);

      await service.buyOption({ contractId: 1, userId: 1, quantity: 10 });

      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ openInterest: 90 }),
      );
    });

    it('should reject buy on inactive contract', async () => {
      contractRepo.findOne.mockResolvedValue({
        ...activeContract,
        status: OptionStatus.EXPIRED,
      });

      await expect(
        service.buyOption({ contractId: 1, userId: 1, quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when insufficient open interest', async () => {
      contractRepo.findOne.mockResolvedValue({
        ...activeContract,
        openInterest: 3,
      });

      await expect(
        service.buyOption({ contractId: 1, userId: 1, quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for missing contract', async () => {
      contractRepo.findOne.mockResolvedValue(null);

      await expect(
        service.buyOption({ contractId: 999, userId: 1, quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('writeOption', () => {
    it('should create a writer position', async () => {
      contractRepo.findOne.mockResolvedValue(activeContract);
      positionRepo.findOne.mockResolvedValue(null);

      const result = await service.writeOption(
        { contractId: 1, userId: 2, quantity: 10 },
        1, // collateralAssetId
      );

      expect(result.isWriter).toBe(true);
      expect(result.quantity).toBe(10);
      expect(result.totalPremium).toBe(25000); // 2500 * 10
    });

    it('should increase existing writer position', async () => {
      contractRepo.findOne.mockResolvedValue(activeContract);
      const existing = {
        userId: 2,
        contractId: 1,
        isWriter: true,
        quantity: 5,
        averagePremium: 2500,
        totalPremium: 12500,
      };
      positionRepo.findOne.mockResolvedValue(existing);

      const result = await service.writeOption(
        { contractId: 1, userId: 2, quantity: 5 },
        1,
      );

      expect(result.quantity).toBe(10);
      expect(result.totalPremium).toBe(25000);
    });
  });

  describe('getUserPositions', () => {
    it('should return user positions', async () => {
      const positions = [
        { id: 1, userId: 1, isWriter: false },
        { id: 2, userId: 1, isWriter: true },
      ];
      positionRepo.find.mockResolvedValue(positions);

      const result = await service.getUserPositions(1);
      expect(result).toEqual(positions);
    });
  });

  describe('getPosition', () => {
    it('should return position by id', async () => {
      const position = { id: 1, userId: 1 };
      positionRepo.findOne.mockResolvedValue(position);

      const result = await service.getPosition(1);
      expect(result).toBe(position);
    });

    it('should throw NotFoundException for missing position', async () => {
      positionRepo.findOne.mockResolvedValue(null);

      await expect(service.getPosition(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUnrealizedPnl', () => {
    it('should calculate unrealized PnL for buyer', async () => {
      const position = {
        id: 1,
        userId: 1,
        contractId: 1,
        isWriter: false,
        quantity: 5,
        totalPremium: 12500,
        averagePremium: 2500,
        exercisedQuantity: 0,
        contract: activeContract,
      };
      positionRepo.findOne.mockResolvedValue(position);

      // BTC went up, call option is more valuable
      const result = await service.updateUnrealizedPnl(1, 60000);
      expect(result.unrealizedPnl).toBeDefined();
    });

    it('should calculate unrealized PnL for writer', async () => {
      const position = {
        id: 1,
        userId: 2,
        contractId: 1,
        isWriter: true,
        quantity: 10,
        totalPremium: 25000,
        averagePremium: 2500,
        exercisedQuantity: 0,
        contract: activeContract,
      };
      positionRepo.findOne.mockResolvedValue(position);

      const result = await service.updateUnrealizedPnl(1, 60000);
      // Writer profits when option loses value
      expect(result.unrealizedPnl).toBeDefined();
    });
  });

  describe('getUserPortfolioSummary', () => {
    it('should aggregate portfolio summary', async () => {
      const positions = [
        {
          isWriter: false,
          totalPremium: 5000,
          unrealizedPnl: 1000,
          realizedPnl: 500,
        },
        {
          isWriter: true,
          totalPremium: 8000,
          unrealizedPnl: -500,
          realizedPnl: 2000,
        },
      ];
      positionRepo.find.mockResolvedValue(positions);

      const result = await service.getUserPortfolioSummary(1);
      expect(result.totalPositions).toBe(2);
      expect(result.totalHolderPositions).toBe(1);
      expect(result.totalWriterPositions).toBe(1);
      expect(result.totalPremiumPaid).toBe(5000);
      expect(result.totalPremiumReceived).toBe(8000);
      expect(result.totalUnrealizedPnl).toBe(500);
      expect(result.totalRealizedPnl).toBe(2500);
    });
  });
});
