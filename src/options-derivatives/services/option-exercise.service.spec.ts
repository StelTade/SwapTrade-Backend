import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OptionExerciseService } from './option-exercise.service';
import { BlackScholesService } from './black-scholes.service';
import { OptionContract } from '../entities/option-contract.entity';
import { OptionPosition } from '../entities/option-position.entity';
import { OptionCollateral } from '../entities/option-collateral.entity';
import { OptionStatus } from '../enums/option-status.enum';
import { OptionType } from '../enums/option-type.enum';
import { ExerciseStyle } from '../enums/exercise-style.enum';
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

const mockDataSource = () => ({
  transaction: jest.fn((fn) => fn({
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    create: jest.fn((_, data) => data),
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    }),
  })),
});

describe('OptionExerciseService', () => {
  let service: OptionExerciseService;
  let contractRepo: ReturnType<typeof mockRepo>;
  let positionRepo: ReturnType<typeof mockRepo>;
  let collateralRepo: ReturnType<typeof mockRepo>;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionExerciseService,
        BlackScholesService,
        { provide: getRepositoryToken(OptionContract), useFactory: mockRepo },
        { provide: getRepositoryToken(OptionPosition), useFactory: mockRepo },
        { provide: getRepositoryToken(OptionCollateral), useFactory: mockRepo },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get(OptionExerciseService);
    contractRepo = module.get(getRepositoryToken(OptionContract));
    positionRepo = module.get(getRepositoryToken(OptionPosition));
    collateralRepo = module.get(getRepositoryToken(OptionCollateral));
    dataSource = module.get(DataSource);
  });

  describe('exerciseOption', () => {
    it('should exercise a call option that is ITM', async () => {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1); // 1 hour from now (within window)

      contractRepo.findOne.mockResolvedValue({
        id: 1,
        optionType: OptionType.CALL,
        exerciseStyle: ExerciseStyle.EUROPEAN,
        strikePrice: 50000,
        contractSize: 1,
        status: OptionStatus.ACTIVE,
        expirationDate: expiry,
        underlyingAssetId: 1,
      });

      positionRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        contractId: 1,
        isWriter: false,
        quantity: 5,
        averagePremium: 2500,
        totalPremium: 12500,
        exercisedQuantity: 0,
      });

      dataSource.transaction.mockImplementation(async (fn: any) => {
        const manager = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn(),
          create: jest.fn((_: any, data: any) => data),
          getRepository: jest.fn().mockReturnValue({
            findOne: jest.fn().mockResolvedValue({
              userId: 2,
              contractId: 1,
              isWriter: true,
              quantity: 10,
              realizedPnl: 0,
            }),
            save: jest.fn(),
          }),
        };
        return fn(manager);
      });

      // Current price 55000, strike 50000, ITM by 5000
      const result = await service.exerciseOption({
        contractId: 1,
        userId: 1,
        quantity: 3,
        currentPrice: 55000,
      });

      expect(result.contractId).toBe(1);
      expect(result.userId).toBe(1);
      expect(result.quantity).toBe(3);
      expect(result.settlementAmount).toBe(15000); // (55000-50000) * 3 * 1
      expect(result.pnl).toBeDefined();
    });

    it('should exercise a put option that is ITM', async () => {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1);

      contractRepo.findOne.mockResolvedValue({
        id: 2,
        optionType: OptionType.PUT,
        exerciseStyle: ExerciseStyle.EUROPEAN,
        strikePrice: 50000,
        contractSize: 1,
        status: OptionStatus.ACTIVE,
        expirationDate: expiry,
        underlyingAssetId: 1,
      });

      positionRepo.findOne.mockResolvedValue({
        id: 2,
        userId: 1,
        contractId: 2,
        isWriter: false,
        quantity: 5,
        averagePremium: 2000,
        totalPremium: 10000,
        exercisedQuantity: 0,
      });

      dataSource.transaction.mockImplementation(async (fn: any) => {
        const manager = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn(),
          create: jest.fn((_: any, data: any) => data),
          getRepository: jest.fn().mockReturnValue({
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
          }),
        };
        return fn(manager);
      });

      // Current price 45000, strike 50000, ITM by 5000
      const result = await service.exerciseOption({
        contractId: 2,
        userId: 1,
        quantity: 2,
        currentPrice: 45000,
      });

      expect(result.settlementAmount).toBe(10000); // (50000-45000) * 2 * 1
    });

    it('should reject exercising inactive contract', async () => {
      contractRepo.findOne.mockResolvedValue({
        id: 1,
        status: OptionStatus.EXPIRED,
      });

      await expect(
        service.exerciseOption({
          contractId: 1,
          userId: 1,
          quantity: 1,
          currentPrice: 55000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject exercising before expiration (European)', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 30); // 30 days from now

      contractRepo.findOne.mockResolvedValue({
        id: 1,
        optionType: OptionType.CALL,
        exerciseStyle: ExerciseStyle.EUROPEAN,
        status: OptionStatus.ACTIVE,
        expirationDate: farFuture,
      });

      positionRepo.findOne.mockResolvedValue({
        quantity: 5,
        exercisedQuantity: 0,
      });

      await expect(
        service.exerciseOption({
          contractId: 1,
          userId: 1,
          quantity: 1,
          currentPrice: 55000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject exercise with insufficient position', async () => {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1);

      contractRepo.findOne.mockResolvedValue({
        id: 1,
        optionType: OptionType.CALL,
        exerciseStyle: ExerciseStyle.EUROPEAN,
        status: OptionStatus.ACTIVE,
        expirationDate: expiry,
      });

      positionRepo.findOne.mockResolvedValue({
        id: 1,
        quantity: 3,
        exercisedQuantity: 0,
      });

      await expect(
        service.exerciseOption({
          contractId: 1,
          userId: 1,
          quantity: 5,
          currentPrice: 55000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when contract not found', async () => {
      contractRepo.findOne.mockResolvedValue(null);

      await expect(
        service.exerciseOption({
          contractId: 999,
          userId: 1,
          quantity: 1,
          currentPrice: 55000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when no position found', async () => {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1);

      contractRepo.findOne.mockResolvedValue({
        id: 1,
        optionType: OptionType.CALL,
        exerciseStyle: ExerciseStyle.EUROPEAN,
        status: OptionStatus.ACTIVE,
        expirationDate: expiry,
      });
      positionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.exerciseOption({
          contractId: 1,
          userId: 1,
          quantity: 1,
          currentPrice: 55000,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('expireContracts', () => {
    it('should expire contracts past their date', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 1, status: OptionStatus.ACTIVE, openInterest: 50 },
          { id: 2, status: OptionStatus.ACTIVE, openInterest: 0 },
        ]),
      };
      contractRepo.createQueryBuilder.mockReturnValue(mockQb);

      const count = await service.expireContracts();
      expect(count).toBe(2);
    });

    it('should return 0 when no contracts to expire', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      contractRepo.createQueryBuilder.mockReturnValue(mockQb);

      const count = await service.expireContracts();
      expect(count).toBe(0);
    });
  });
});
