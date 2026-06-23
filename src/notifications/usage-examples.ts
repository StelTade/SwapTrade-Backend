import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './services/notifications.service';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';
import { NotificationChannel } from '../common/enums/notification-channel.enum';

@Injectable()
export class NotificationEventListeners {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('trade.executed')
  async handleTradeExecuted(payload: {
    userId: string;
    amount: number;
    asset: string;
    price: number;
    totalValue: number;
  }) {
    await this.notificationsService.sendNotification({
      userId: payload.userId,
      type: NotificationEventType.TRADE_EXECUTED,
      data: {
        amount: payload.amount,
        asset: payload.asset,
        price: payload.price,
        totalValue: payload.totalValue,
      },
    });
  }

  @OnEvent('deposit.received')
  async handleDepositReceived(payload: {
    userId: string;
    amount: number;
    asset: string;
    txHash: string;
  }) {
    await this.notificationsService.sendNotification({
      userId: payload.userId,
      type: NotificationEventType.DEPOSIT_RECEIVED,
      data: {
        amount: payload.amount,
        asset: payload.asset,
        txHash: payload.txHash,
      },
    });
  }

  @OnEvent('position.liquidated')
  async handleLiquidation(payload: {
    userId: string;
    amount: number;
    asset: string;
    price: number;
  }) {
    // Liquidations are critical - force SMS even if user has it disabled
    await this.notificationsService.sendNotification({
      userId: payload.userId,
      type: NotificationEventType.LIQUIDATION,
      data: {
        amount: payload.amount,
        asset: payload.asset,
        price: payload.price,
      },
      forceChannels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH], // Always send all channels for liquidations
    });
  }

  @OnEvent('withdrawal.completed')
  async handleWithdrawalCompleted(payload: {
    userId: string;
    amount: number;
    asset: string;
    address: string;
    txHash: string;
  }) {
    await this.notificationsService.sendNotification({
      userId: payload.userId,
      type: NotificationEventType.WITHDRAWAL_COMPLETED,
      data: {
        amount: payload.amount,
        asset: payload.asset,
        address: payload.address,
        txHash: payload.txHash,
      },
    });
  }

  @OnEvent('security.login_detected')
  async handleSecurityAlert(payload: {
    userId: string;
    ipAddress: string;
    timestamp: string;
  }) {
    // Security alerts are critical - force all channels
    await this.notificationsService.sendNotification({
      userId: payload.userId,
      type: NotificationEventType.SECURITY_ALERT,
      data: {
        ipAddress: payload.ipAddress,
        timestamp: payload.timestamp,
      },
      forceChannels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
    });
  }
}