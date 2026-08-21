import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './services/notifications.service';
import { WebhooksService } from './services/webhooks.service';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';
import { NotificationChannel } from '../common/enums/notification-channel.enum';

@Injectable()
export class NotificationEventListeners {
  private readonly logger = new Logger(NotificationEventListeners.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly webhooksService: WebhooksService,
  ) {}

  // ── Order Events ──

  @OnEvent('order.placed')
  async handleOrderPlaced(payload: {
    userId: string;
    orderId: string;
    side: string;
    pair: string;
    price: number;
    amount: number;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.ORDER_PLACED,
      { ...payload },
    );
  }

  @OnEvent('order.filled')
  async handleOrderFilled(payload: {
    userId: string;
    orderId: string;
    tradeId: string;
    side: string;
    pair: string;
    price: number;
    amount: number;
    totalValue: number;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.ORDER_FILLED,
      { ...payload },
    );
  }

  @OnEvent('order.cancelled')
  async handleOrderCancelled(payload: {
    userId: string;
    orderId: string;
    reason: string;
    pair: string;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.ORDER_CANCELLED,
      { ...payload },
    );
  }

  // ── Trade Events ──

  @OnEvent('trade.executed')
  async handleTradeExecuted(payload: {
    userId: string;
    tradeId: string;
    amount: number;
    asset: string;
    price: number;
    totalValue: number;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.TRADE_EXECUTED,
      { ...payload },
    );
  }

  // ── Deposit Events ──

  @OnEvent('deposit.received')
  async handleDepositReceived(payload: {
    userId: string;
    depositId: string;
    amount: number;
    asset: string;
    txHash: string;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.DEPOSIT_RECEIVED,
      { ...payload },
    );
  }

  @OnEvent('deposit.confirmed')
  async handleDepositConfirmed(payload: {
    userId: string;
    depositId: string;
    amount: number;
    asset: string;
    txHash: string;
    confirmations: number;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.DEPOSIT_CONFIRMED,
      { ...payload },
    );
  }

  @OnEvent('deposit.failed')
  async handleDepositFailed(payload: {
    userId: string;
    depositId: string;
    amount: number;
    asset: string;
    reason: string;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.DEPOSIT_FAILED,
      { ...payload },
    );
  }

  // ── Withdrawal Events ──

  @OnEvent('withdrawal.completed')
  async handleWithdrawalCompleted(payload: {
    userId: string;
    withdrawalId: string;
    amount: number;
    asset: string;
    address: string;
    txHash: string;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.WITHDRAWAL_COMPLETED,
      { ...payload },
    );
  }

  @OnEvent('withdrawal.confirmed')
  async handleWithdrawalConfirmed(payload: {
    userId: string;
    withdrawalId: string;
    amount: number;
    asset: string;
    txHash: string;
    confirmations: number;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.WITHDRAWAL_CONFIRMED,
      { ...payload },
    );
  }

  @OnEvent('withdrawal.failed')
  async handleWithdrawalFailed(payload: {
    userId: string;
    withdrawalId: string;
    amount: number;
    asset: string;
    reason: string;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.WITHDRAWAL_FAILED,
      { ...payload },
    );
  }

  // ── KYC Events ──

  @OnEvent('kyc.status_changed')
  async handleKycStatusChanged(payload: {
    userId: string;
    kycRecordId: string;
    previousStatus: string;
    newStatus: string;
  }) {
    await this.sendAndDispatch(
      payload.userId,
      NotificationEventType.KYC_STATUS_CHANGE,
      { ...payload },
    );
  }

  // ── Margin / Risk Events (critical — force all channels) ──

  @OnEvent('position.liquidated')
  async handleLiquidation(payload: {
    userId: string;
    amount: number;
    asset: string;
    price: number;
  }) {
    // Liquidations are critical — force SMS even if user has it disabled
    await this.notificationsService.sendNotification({
      userId: payload.userId,
      type: NotificationEventType.LIQUIDATION,
      data: {
        amount: payload.amount,
        asset: payload.asset,
        price: payload.price,
      },
      forceChannels: [
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
        NotificationChannel.PUSH,
      ],
    });

    // Also dispatch to webhooks
    await this.webhooksService.dispatchEvent(
      payload.userId,
      NotificationEventType.LIQUIDATION,
      { ...payload },
    );
  }

  @OnEvent('margin.call')
  async handleMarginCall(payload: {
    userId: string;
    positionId: string;
    currentMargin: number;
    maintenanceMargin: number;
  }) {
    await this.notificationsService.sendNotification({
      userId: payload.userId,
      type: NotificationEventType.MARGIN_CALL,
      data: { ...payload },
      forceChannels: [
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
        NotificationChannel.PUSH,
      ],
    });

    await this.webhooksService.dispatchEvent(
      payload.userId,
      NotificationEventType.MARGIN_CALL,
      { ...payload },
    );
  }

  // ── Security Events ──

  @OnEvent('security.login_detected')
  async handleSecurityAlert(payload: {
    userId: string;
    ipAddress: string;
    timestamp: string;
  }) {
    // Security alerts are critical — force all channels
    await this.notificationsService.sendNotification({
      userId: payload.userId,
      type: NotificationEventType.SECURITY_ALERT,
      data: {
        ipAddress: payload.ipAddress,
        timestamp: payload.timestamp,
      },
      forceChannels: [
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
        NotificationChannel.PUSH,
      ],
    });

    await this.webhooksService.dispatchEvent(
      payload.userId,
      NotificationEventType.SECURITY_ALERT,
      { ...payload },
    );
  }

  // ── Helper: Send in-app/email/SMS + dispatch to webhooks ──

  private async sendAndDispatch(
    userId: string,
    eventType: NotificationEventType,
    data: Record<string, any>,
  ): Promise<void> {
    // Send in-app/email/SMS notifications (respects user preferences)
    await this.notificationsService.sendNotification({
      userId,
      type: eventType,
      data,
    });

    // Dispatch to registered webhook endpoints
    await this.webhooksService.dispatchEvent(userId, eventType, data);
  }
}
