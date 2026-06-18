import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptedOrderService } from '../services/encrypted-order.service';
import { PrivacyEncryptionService } from '../services/privacy-encryption.service';
import {
  EncryptedOrder,
  EncryptedOrderStatus,
} from '../entities/encrypted-order.entity';

describe('EncryptedOrderService', () => {
  let service: EncryptedOrderService;
  let repository: Repository<EncryptedOrder>;
  let encryptionService: PrivacyEncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptedOrderService,
        PrivacyEncryptionService,
        {
          provide: getRepositoryToken(EncryptedOrder),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptedOrderService>(EncryptedOrderService);
    repository = module.get<Repository<EncryptedOrder>>(
      getRepositoryToken(EncryptedOrder),
    );
    encryptionService = module.get<PrivacyEncryptionService>(
      PrivacyEncryptionService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    it('should create an encrypted order', async () => {
      const createDto = {
        encryptedOrderDetails:
          'encrypted-data-encrypted-data-encrypted-data-encrypted-data',
        orderHash: 'hash-value',
        encryptionNonce: 'nonce-value',
        orderMetadata: { symbol: 'BTC/USD', side: 'BUY' as const },
      };

      jest.spyOn(repository, 'save').mockResolvedValue({
        id: 'order-id',
        pseudonymousId: 'pseudo-id',
        ...createDto,
        status: EncryptedOrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createOrder('pseudo-id', createDto);

      expect(result).toBeDefined();
      expect(result.status).toBe(EncryptedOrderStatus.PENDING);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('getOrderById', () => {
    it('should get order by ID', async () => {
      const order = {
        id: 'order-id',
        pseudonymousId: 'pseudo-id',
        status: EncryptedOrderStatus.PENDING,
      } as any;

      jest.spyOn(repository, 'findOne').mockResolvedValue(order);

      const result = await service.getOrderById('order-id');

      expect(result).toEqual(order);
    });

    it('should return null if order not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.getOrderById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('cancelOrder', () => {
    it('should cancel a pending order', async () => {
      const order = {
        id: 'order-id',
        status: EncryptedOrderStatus.PENDING,
      } as any;

      jest.spyOn(repository, 'findOne').mockResolvedValue(order);
      jest.spyOn(repository, 'save').mockResolvedValue({
        ...order,
        status: EncryptedOrderStatus.CANCELLED,
      });

      const result = await service.cancelOrder('order-id');

      expect(result.status).toBe(EncryptedOrderStatus.CANCELLED);
    });

    it('should throw when cancelling executed order', async () => {
      const order = {
        id: 'order-id',
        status: EncryptedOrderStatus.EXECUTED,
      } as any;

      jest.spyOn(repository, 'findOne').mockResolvedValue(order);

      await expect(service.cancelOrder('order-id')).rejects.toThrow();
    });

    it('should throw if order not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.cancelOrder('non-existent')).rejects.toThrow();
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const order = {
        id: 'order-id',
        status: EncryptedOrderStatus.PENDING,
      } as any;

      jest.spyOn(repository, 'findOne').mockResolvedValue(order);
      jest.spyOn(repository, 'save').mockResolvedValue({
        ...order,
        status: EncryptedOrderStatus.MATCHED,
        matchedAt: new Date(),
      });

      const result = await service.updateOrderStatus(
        'order-id',
        EncryptedOrderStatus.MATCHED,
      );

      expect(result.status).toBe(EncryptedOrderStatus.MATCHED);
      expect(result.matchedAt).toBeDefined();
    });
  });

  describe('getOrdersByStatus', () => {
    it('should get orders by status', async () => {
      const orders = [
        { id: 'order-1', status: EncryptedOrderStatus.PENDING },
        { id: 'order-2', status: EncryptedOrderStatus.PENDING },
      ];

      jest.spyOn(repository, 'find').mockResolvedValue(orders as any);

      const result = await service.getOrdersByStatus(
        EncryptedOrderStatus.PENDING,
      );

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe(EncryptedOrderStatus.PENDING);
    });
  });

  describe('encryption/integrity verification', () => {
    it('should verify order integrity', async () => {
      const encryptionKey = encryptionService.generateRandomBytes(32);
      const orderData = 'BTC/USD:LIMIT:1.5:50000';

      const expectedHash = encryptionService.generateHMAC(
        orderData,
        encryptionKey,
      );

      const order = {
        id: 'order-id',
        orderHash: expectedHash,
      } as any;

      jest.spyOn(repository, 'findOne').mockResolvedValue(order);

      const isValid = await service.verifyOrderIntegrity(
        'order-id',
        expectedHash,
      );

      expect(isValid).toBe(true);
    });
  });

  describe('toResponseDto', () => {
    it('should convert order to response DTO', () => {
      const order = {
        id: 'order-id',
        pseudonymousId: 'pseudo-id',
        orderHash: 'hash',
        orderMetadata: { symbol: 'BTC/USD', side: 'BUY' },
        status: EncryptedOrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        encryptedOrderDetails: 'encrypted-data',
      } as any;

      const dto = service.toResponseDto(order);

      expect(dto).toMatchObject({
        id: 'order-id',
        pseudonymousId: 'pseudo-id',
        status: EncryptedOrderStatus.PENDING,
      });

      // Encrypted details should not be in response by default
      expect(dto).not.toHaveProperty('encryptedOrderDetails');
    });
  });
});
