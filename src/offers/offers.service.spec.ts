import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OffersService } from './offers.service';
import { Offer } from './entities/offer.entity';
import { OfferStatus } from './enums/offer-status.enum';
import { User } from '../user/user.entity';
import { Portfolio } from '../portfolio/entities/portfolio.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Notification } from '../notifications/entities/notification.entity';

describe('OffersService', () => {
  let service: OffersService;
  let offerRepository: Repository<Offer>;
  let userRepository: Repository<User>;
  let portfolioRepository: Repository<Portfolio>;
  let transactionRepository: Repository<Transaction>;
  let notificationsService: NotificationsService;
  let dataSource: DataSource;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockNotificationsService = {
    createAndBroadcast: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        {
          provide: getRepositoryToken(Offer),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getCount: jest.fn(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Portfolio),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
    offerRepository = module.get<Repository<Offer>>(getRepositoryToken(Offer));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    portfolioRepository = module.get<Repository<Portfolio>>(getRepositoryToken(Portfolio));
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    notificationsService = module.get<NotificationsService>(NotificationsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOffer', () => {
    const createOfferDto: CreateOfferDto = {
      offeredAssetId: 1,
      requestedAssetId: 2,
      recipientId: 2,
      message: 'Test offer',
    };

    const mockUser = { id: 2, email: 'recipient@test.com' };
    const mockOfferedAsset = { id: 1, name: 'BTC Portfolio', user: { id: 1 } };
    const mockRequestedAsset = { id: 2, name: 'ETH Portfolio', user: { id: 2 } };
    const mockOffer = {
      id: 'test-uuid',
      ...createOfferDto,
      initiatorId: 1,
      status: OfferStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create an offer successfully', async () => {
      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(portfolioRepository, 'findOne')
        .mockResolvedValueOnce(mockOfferedAsset as Portfolio)
        .mockResolvedValueOnce(mockRequestedAsset as Portfolio);
      jest.spyOn(offerRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(offerRepository, 'create').mockReturnValue(mockOffer as Offer);
      mockQueryRunner.manager.save.mockResolvedValue(mockOffer);
      jest.spyOn(notificationsService, 'createAndBroadcast').mockResolvedValue({
        id: 'test-notification-id',
        userId: '2',
        type: 'offerCreated',
        payload: {},
        timestamp: new Date(),
        read: false,
      } as Notification);

      // Act
      const result = await service.createOffer(createOfferDto, 1);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockOffer.id);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(notificationsService.createAndBroadcast).toHaveBeenCalledWith(
        '2',
        expect.any(String),
        expect.objectContaining({
          offerId: mockOffer.id,
          initiatorId: 1,
        })
      );
    });

    it('should throw error if recipient not found', async () => {
      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(service.createOffer(createOfferDto, 1))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw error if initiator tries to trade with themselves', async () => {
      // Arrange
      const selfTradeDto = { ...createOfferDto, recipientId: 1 };

      // Act & Assert
      await expect(service.createOffer(selfTradeDto, 1))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw error if offered asset not found', async () => {
      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(portfolioRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(service.createOffer(createOfferDto, 1))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw error if initiator does not own offered asset', async () => {
      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(portfolioRepository, 'findOne')
        .mockResolvedValueOnce({ ...mockOfferedAsset, user: { id: 999 } } as Portfolio);

      // Act & Assert
      await expect(service.createOffer(createOfferDto, 1))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return paginated offers for user', async () => {
      // Arrange
      const mockOffers = [
        { id: '1', initiatorId: 1, recipientId: 2, status: OfferStatus.PENDING },
        { id: '2', initiatorId: 2, recipientId: 1, status: OfferStatus.ACCEPTED },
      ];
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockOffers),
      };
      jest.spyOn(offerRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      // Act
      const result = await service.findAll({ page: 1, limit: 10 }, 1);

      // Assert
      expect(result.offers).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('findOne', () => {
    it('should return offer if user has access', async () => {
      // Arrange
      const mockOffer = {
        id: 'test-uuid',
        initiatorId: 1,
        recipientId: 2,
        status: OfferStatus.PENDING,
        initiator: { id: 1, firstname: 'John', email: 'john@test.com' },
        recipient: { id: 2, firstname: 'Jane', email: 'jane@test.com' },
      };
      jest.spyOn(offerRepository, 'findOne').mockResolvedValue(mockOffer as any);

      // Act
      const result = await service.findOne('test-uuid', 1);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockOffer.id);
    });

    it('should throw error if user does not have access', async () => {
      // Arrange
      const mockOffer = {
        id: 'test-uuid',
        initiatorId: 999,
        recipientId: 888,
      };
      jest.spyOn(offerRepository, 'findOne').mockResolvedValue(mockOffer as any);

      // Act & Assert
      await expect(service.findOne('test-uuid', 1))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('acceptOffer', () => {
    it('should accept offer successfully', async () => {
      // Arrange
      const mockOffer = {
        id: 'test-uuid',
        initiatorId: 1,
        recipientId: 2,
        status: OfferStatus.PENDING,
        offeredAssetId: 1,
        requestedAssetId: 2,
        offeredAsset: { id: 1, name: 'BTC Portfolio', user: { id: 1 } },
        requestedAsset: { id: 2, name: 'ETH Portfolio', user: { id: 2 } },
      };
      jest.spyOn(offerRepository, 'findOne').mockResolvedValue(mockOffer as any);
      jest.spyOn(portfolioRepository, 'findOne')
        .mockResolvedValueOnce(mockOffer.offeredAsset as Portfolio)
        .mockResolvedValueOnce(mockOffer.requestedAsset as Portfolio);
      mockQueryRunner.manager.save.mockResolvedValue({ ...mockOffer, status: OfferStatus.ACCEPTED });
      jest.spyOn(transactionRepository, 'create').mockReturnValue({} as Transaction);

      // Act
      const result = await service.acceptOffer('test-uuid', 2);

      // Assert
      expect(result).toBeDefined();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw error if only recipient can accept', async () => {
      // Arrange
      const mockOffer = {
        id: 'test-uuid',
        initiatorId: 1,
        recipientId: 2,
        status: OfferStatus.PENDING,
      };
      jest.spyOn(offerRepository, 'findOne').mockResolvedValue(mockOffer as any);

      // Act & Assert
      await expect(service.acceptOffer('test-uuid', 1))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('declineOffer', () => {
    it('should decline offer successfully', async () => {
      // Arrange
      const mockOffer = {
        id: 'test-uuid',
        initiatorId: 1,
        recipientId: 2,
        status: OfferStatus.PENDING,
      };
      jest.spyOn(offerRepository, 'findOne').mockResolvedValue(mockOffer as any);
      jest.spyOn(offerRepository, 'save').mockResolvedValue({ ...mockOffer, status: OfferStatus.DECLINED } as any);

      // Act
      const result = await service.declineOffer('test-uuid', 2);

      // Assert
      expect(result).toBeDefined();
      expect(notificationsService.createAndBroadcast).toHaveBeenCalled();
    });
  });

  describe('cancelOffer', () => {
    it('should cancel offer successfully', async () => {
      // Arrange
      const mockOffer = {
        id: 'test-uuid',
        initiatorId: 1,
        recipientId: 2,
        status: OfferStatus.PENDING,
      };
      jest.spyOn(offerRepository, 'findOne').mockResolvedValue(mockOffer as any);
      jest.spyOn(offerRepository, 'save').mockResolvedValue({ ...mockOffer, status: OfferStatus.CANCELLED } as any);

      // Act
      const result = await service.cancelOffer('test-uuid', 1);

      // Assert
      expect(result).toBeDefined();
      expect(notificationsService.createAndBroadcast).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredOffers', () => {
    it('should expire offers that have passed their expiration date', async () => {
      // Arrange
      const now = new Date();
      const expiredOffer = {
        id: 'expired-uuid',
        status: OfferStatus.PENDING,
        expiresAt: new Date(now.getTime() - 1000), 
      };
      const validOffer = {
        id: 'valid-uuid',
        status: OfferStatus.PENDING,
        expiresAt: new Date(now.getTime() + 1000), 
      };
      jest.spyOn(offerRepository, 'find').mockResolvedValue([expiredOffer, validOffer] as any);
      jest.spyOn(offerRepository, 'save').mockResolvedValue([{ ...expiredOffer, status: OfferStatus.EXPIRED }] as any);

      // Act
      const result = await service.cleanupExpiredOffers();

      // Assert
      expect(result).toBe(1);
      expect(offerRepository.save).toHaveBeenCalledWith([{ ...expiredOffer, status: OfferStatus.EXPIRED }]);
    });
  });
}); 