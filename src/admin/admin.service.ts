import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { AuditLog } from '../common/security/audit-log.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Trade } from '../database/entities/trade.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { OrderStatus, OrderSide } from '../common/enums/order-type.enum';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRepository(UserBalance)
    private readonly userBalanceRepo: Repository<UserBalance>,
  ) {}

  async searchUsers(search: string, page: number = 1, limit: number = 10) {
    const qb = this.userRepo.createQueryBuilder('u')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('u.createdAt', 'DESC');
      
    if (search) {
      qb.where('u.username LIKE :search OR u.email LIKE :search', { search: `%${search}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOrders(userId?: number, status?: string, page: number = 1, limit: number = 10) {
    const qb = this.orderRepo.createQueryBuilder('o')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('o.createdAt', 'DESC');
      
    if (userId) qb.andWhere('o.userId = :userId', { userId });
    if (status) qb.andWhere('o.status = :status', { status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getTrades(userId?: number, page: number = 1, limit: number = 10) {
    const qb = this.tradeRepo.createQueryBuilder('t')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('t.createdAt', 'DESC');
      
    if (userId) qb.andWhere('t.userId = :userId', { userId });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async cancelOrder(orderId: string, adminId: string): Promise<any> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PARTIAL) {
      throw new BadRequestException(`Order cannot be cancelled in status ${order.status}`);
    }

    // Un-reserve balance if it was a SELL order
    if (order.side === OrderSide.SELL) {
      const remaining = Number(order.amount) - Number(order.filledAmount);
      const userBalance = await this.userBalanceRepo.findOne({
        where: { userId: order.userId, assetId: order.assetId }
      });
      if (userBalance) {
        userBalance.lockedBalance = Number(userBalance.lockedBalance) - remaining;
        await this.userBalanceRepo.save(userBalance);
      }
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    await this.orderRepo.save(order);

    await this.auditEntry(adminId, 'cancel_order', 'order', orderId, { previousStatus: order.status });
    
    return { success: true, order };
  }

  async refundOrder(orderId: string, adminId: string): Promise<any> {
    // In this context, refunding implies cancelling an order that was somehow stuck or needs manual rollback.
    // It shares identical logic with cancelOrder for now, with a different audit trail.
    const result = await this.cancelOrder(orderId, adminId);
    await this.auditEntry(adminId, 'refund_order', 'order', orderId, { note: 'Manual refund triggered' });
    return result;
  }

  async getAuditLogs(page: number = 1, limit: number = 10) {
    const [data, total] = await this.auditRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async auditEntry(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    payload?: object,
  ): Promise<void> {
    await this.auditRepo.save(
      this.auditRepo.create({
        userId: adminId,
        eventType: action as any,
        entityType: targetType,
        entityId: targetId,
        metadata: payload,
      }),
    );
  }
}
