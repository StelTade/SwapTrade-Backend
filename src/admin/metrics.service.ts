import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Registry, Gauge } from 'prom-client';

import { User } from '../user/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Trade } from '../database/entities/trade.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { AccountStatus } from '../auth/entities/auth.entity';
import { OrderStatus } from '../common/enums/order-type.enum';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  
  private readonly activeUsersGauge: Gauge;
  private readonly openOrdersGauge: Gauge;
  private readonly escrowTotalGauge: Gauge;
  private readonly volume24hGauge: Gauge;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRepository(UserBalance)
    private readonly userBalanceRepo: Repository<UserBalance>,
  ) {
    this.registry = new Registry();

    this.activeUsersGauge = new Gauge({
      name: 'swaptrade_active_users',
      help: 'Count of active users',
      registers: [this.registry],
    });

    this.openOrdersGauge = new Gauge({
      name: 'swaptrade_open_orders',
      help: 'Count of open (pending) orders',
      registers: [this.registry],
    });

    this.escrowTotalGauge = new Gauge({
      name: 'swaptrade_escrow_total',
      help: 'Total value in escrow (locked balances)',
      registers: [this.registry],
    });

    this.volume24hGauge = new Gauge({
      name: 'swaptrade_24h_volume',
      help: 'Total trading volume in the last 24 hours',
      registers: [this.registry],
    });
  }

  async updateMetrics(): Promise<void> {
    const activeUsers = await this.userRepo.count({
      where: { status: AccountStatus.ACTIVE, isSuspended: false },
    });
    this.activeUsersGauge.set(activeUsers);

    const openOrders = await this.orderRepo.count({
      where: { status: OrderStatus.PENDING },
    });
    this.openOrdersGauge.set(openOrders);

    const escrowResult = await this.userBalanceRepo
      .createQueryBuilder('ub')
      .select('SUM(ub.lockedBalance)', 'total')
      .getRawOne();
    
    const escrowTotal = escrowResult?.total ? parseFloat(escrowResult.total) : 0;
    this.escrowTotalGauge.set(escrowTotal);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const volumeResult = await this.tradeRepo
      .createQueryBuilder('t')
      .select('SUM(t.totalValue)', 'volume')
      .where('t.createdAt >= :yesterday', { yesterday })
      .getRawOne();
      
    const volume24h = volumeResult?.volume ? parseFloat(volumeResult.volume) : 0;
    this.volume24hGauge.set(volume24h);
  }

  async getMetrics(): Promise<string> {
    await this.updateMetrics();
    return this.registry.metrics();
  }

  async getMetricsJson(): Promise<any> {
    await this.updateMetrics();
    
    const metrics = await this.registry.getMetricsAsJSON();
    
    const activeUsers = metrics.find((m) => m.name === 'swaptrade_active_users')?.values[0]?.value || 0;
    const openOrders = metrics.find((m) => m.name === 'swaptrade_open_orders')?.values[0]?.value || 0;
    const escrowTotal = metrics.find((m) => m.name === 'swaptrade_escrow_total')?.values[0]?.value || 0;
    const volume24h = metrics.find((m) => m.name === 'swaptrade_24h_volume')?.values[0]?.value || 0;

    return {
      activeUsers,
      openOrders,
      escrowTotal,
      '24hVolume': volume24h,
    };
  }
}
