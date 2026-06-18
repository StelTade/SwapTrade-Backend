import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  EncryptedOrder,
  EncryptedOrderStatus,
} from '../entities/encrypted-order.entity';
import {
  CreateEncryptedOrderDto,
  UpdateEncryptedOrderDto,
  EncryptedOrderResponseDto,
  DecryptedOrderDto,
} from '../dto/encrypted-order.dto';
import { PrivacyEncryptionService } from './privacy-encryption.service';

@Injectable()
export class EncryptedOrderService {
  constructor(
    @InjectRepository(EncryptedOrder)
    private readonly encryptedOrderRepository: Repository<EncryptedOrder>,
    private readonly encryptionService: PrivacyEncryptionService,
  ) {}

  /**
   * Create a new encrypted order
   * @param pseudonymousId Pseudonymous user ID
   * @param createDto Order creation DTO
   * @returns Created encrypted order
   */
  async createOrder(
    pseudonymousId: string,
    createDto: CreateEncryptedOrderDto,
  ): Promise<EncryptedOrder> {
    const order = new EncryptedOrder();
    order.id = uuidv4();
    order.pseudonymousId = pseudonymousId;
    order.encryptedOrderDetails = createDto.encryptedOrderDetails;
    order.orderHash = createDto.orderHash;
    order.encryptionNonce = createDto.encryptionNonce;
    order.orderMetadata = createDto.orderMetadata;
    order.status = EncryptedOrderStatus.PENDING;
    order.encryptedZKProof = createDto.encryptedZKProof;

    return await this.encryptedOrderRepository.save(order);
  }

  /**
   * Get an encrypted order by ID
   * @param orderId Order ID
   * @returns Encrypted order or null
   */
  async getOrderById(orderId: string): Promise<EncryptedOrder | null> {
    return await this.encryptedOrderRepository.findOne({
      where: { id: orderId },
    });
  }

  /**
   * Get encrypted orders for a pseudonymous user
   * @param pseudonymousId Pseudonymous user ID
   * @param status Optional filter by status
   * @returns Array of encrypted orders
   */
  async getOrdersByPseudonymousId(
    pseudonymousId: string,
    status?: EncryptedOrderStatus,
  ): Promise<EncryptedOrder[]> {
    const query = this.encryptedOrderRepository
      .createQueryBuilder('order')
      .where('order.pseudonymousId = :pseudonymousId', { pseudonymousId });

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    return await query.orderBy('order.createdAt', 'DESC').getMany();
  }

  /**
   * Update an encrypted order
   * @param orderId Order ID
   * @param updateDto Update DTO
   * @returns Updated order
   */
  async updateOrder(
    orderId: string,
    updateDto: UpdateEncryptedOrderDto,
  ): Promise<EncryptedOrder> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (updateDto.status) {
      order.status = updateDto.status;
    }

    if (updateDto.linkedOrderId) {
      order.linkedOrderId = updateDto.linkedOrderId;
    }

    if (updateDto.encryptedMatchDetails) {
      order.encryptedMatchDetails = updateDto.encryptedMatchDetails;
      order.matchedAt = new Date();
    }

    return await this.encryptedOrderRepository.save(order);
  }

  /**
   * Update order status
   * @param orderId Order ID
   * @param newStatus New status
   * @returns Updated order
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: EncryptedOrderStatus,
  ): Promise<EncryptedOrder> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    order.status = newStatus;
    if (newStatus === EncryptedOrderStatus.MATCHED) {
      order.matchedAt = new Date();
    }

    return await this.encryptedOrderRepository.save(order);
  }

  /**
   * Cancel an encrypted order
   * @param orderId Order ID
   * @returns Cancelled order
   */
  async cancelOrder(orderId: string): Promise<EncryptedOrder> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (order.status === EncryptedOrderStatus.EXECUTED) {
      throw new BadRequestException('Cannot cancel executed order');
    }

    order.status = EncryptedOrderStatus.CANCELLED;
    return await this.encryptedOrderRepository.save(order);
  }

  /**
   * Delete an encrypted order
   * @param orderId Order ID
   */
  async deleteOrder(orderId: string): Promise<void> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    await this.encryptedOrderRepository.remove(order);
  }

  /**
   * Store decrypted order details (encrypted again for storage)
   * This allows the server to re-encrypt with a different key
   * @param orderId Order ID
   * @param encryptedDetails Encrypted decrypted details
   */
  async storeDecryptedOrderDetails(
    orderId: string,
    encryptedDetails: string,
  ): Promise<void> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    order.encryptedMatchDetails = encryptedDetails;
    await this.encryptedOrderRepository.save(order);
  }

  /**
   * Get orders by status
   * @param status Order status
   * @returns Array of orders
   */
  async getOrdersByStatus(
    status: EncryptedOrderStatus,
  ): Promise<EncryptedOrder[]> {
    return await this.encryptedOrderRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get pending orders (not yet matched or executed)
   * @returns Array of pending orders
   */
  async getPendingOrders(): Promise<EncryptedOrder[]> {
    return await this.encryptedOrderRepository.find({
      where: { status: EncryptedOrderStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get matched orders
   * @param pseudonymousId Optional filter by user
   * @returns Array of matched orders
   */
  async getMatchedOrders(pseudonymousId?: string): Promise<EncryptedOrder[]> {
    const query = this.encryptedOrderRepository
      .createQueryBuilder('order')
      .where('order.status = :status', {
        status: EncryptedOrderStatus.MATCHED,
      });

    if (pseudonymousId) {
      query.andWhere('order.pseudonymousId = :pseudonymousId', {
        pseudonymousId,
      });
    }

    return await query.orderBy('order.matchedAt', 'DESC').getMany();
  }

  /**
   * Count total encrypted orders
   * @returns Total count
   */
  async countTotalOrders(): Promise<number> {
    return await this.encryptedOrderRepository.count();
  }

  /**
   * Count orders by pseudonymous user
   * @param pseudonymousId Pseudonymous user ID
   * @returns Order count
   */
  async countOrdersByUser(pseudonymousId: string): Promise<number> {
    return await this.encryptedOrderRepository.count({
      where: { pseudonymousId },
    });
  }

  /**
   * Get encrypted orders within a time range
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of orders
   */
  async getOrdersByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<EncryptedOrder[]> {
    return await this.encryptedOrderRepository
      .createQueryBuilder('order')
      .where('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('order.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Verify HMAC integrity of order
   * @param orderId Order ID
   * @param expectedHash Expected HMAC hash
   * @returns True if integrity check passes
   */
  async verifyOrderIntegrity(
    orderId: string,
    expectedHash: string,
  ): Promise<boolean> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    return order.orderHash === expectedHash;
  }

  /**
   * Convert order to response DTO (can omit encrypted data)
   * @param order Encrypted order entity
   * @param includeEncrypted Whether to include encrypted data
   * @returns Response DTO
   */
  toResponseDto(
    order: EncryptedOrder,
    includeEncrypted: boolean = false,
  ): EncryptedOrderResponseDto {
    const dto: EncryptedOrderResponseDto = {
      id: order.id,
      pseudonymousId: order.pseudonymousId,
      orderHash: order.orderHash,
      orderMetadata: order.orderMetadata,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    return dto;
  }

  /**
   * Match an encrypted order with another one
   * @param orderId Primary order ID
   * @param matchingOrderId Matching order ID
   * @param matchedDetails Encrypted details of match
   * @returns Updated primary order
   */
  async matchOrder(
    orderId: string,
    matchingOrderId: string,
    matchedDetails: string,
  ): Promise<EncryptedOrder> {
    const order = await this.updateOrder(orderId, {
      status: EncryptedOrderStatus.MATCHED,
      linkedOrderId: matchingOrderId,
      encryptedMatchDetails: matchedDetails,
    });

    // Also update the matching order
    await this.updateOrderStatus(matchingOrderId, EncryptedOrderStatus.MATCHED);

    return order;
  }

  /**
   * Get execution statistics
   * @returns Execution stats
   */
  async getExecutionStats(): Promise<{
    totalOrders: number;
    pendingOrders: number;
    matchedOrders: number;
    executedOrders: number;
    cancelledOrders: number;
  }> {
    const [
      totalOrders,
      pendingOrders,
      matchedOrders,
      executedOrders,
      cancelledOrders,
    ] = await Promise.all([
      this.encryptedOrderRepository.count(),
      this.encryptedOrderRepository.count({
        where: { status: EncryptedOrderStatus.PENDING },
      }),
      this.encryptedOrderRepository.count({
        where: { status: EncryptedOrderStatus.MATCHED },
      }),
      this.encryptedOrderRepository.count({
        where: { status: EncryptedOrderStatus.EXECUTED },
      }),
      this.encryptedOrderRepository.count({
        where: { status: EncryptedOrderStatus.CANCELLED },
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      matchedOrders,
      executedOrders,
      cancelledOrders,
    };
  }
}
