import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum RealtimeEventType {
  MARKET_DATA_UPDATE = 'market_data_update',
  ORDERBOOK_UPDATE = 'orderbook_update',
  POSITION_CHANGE = 'position_change',
  BALANCE_UPDATE = 'balance_update',
  ALERT_NOTIFICATION = 'alert_notification',
  HEATMAP_UPDATE = 'heatmap_update',
  TRADE_EXECUTION = 'trade_execution',
  ORDER_STATUS_CHANGE = 'order_status_change',
  PRICE_ALERT = 'price_alert',
  SYSTEM_NOTIFICATION = 'system_notification',
}

@Injectable()
export class RealtimeEventsService {
  private readonly logger = new Logger(RealtimeEventsService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  emitMarketDataUpdate(data: any): void {
    this.emitEvent(RealtimeEventType.MARKET_DATA_UPDATE, data);
  }

  emitOrderBookUpdate(data: any): void {
    this.emitEvent(RealtimeEventType.ORDERBOOK_UPDATE, data);
  }

  emitPositionChange(userId: string, data: any): void {
    this.emitToUser(userId, RealtimeEventType.POSITION_CHANGE, data);
  }

  emitBalanceUpdate(userId: string, data: any): void {
    this.emitToUser(userId, RealtimeEventType.BALANCE_UPDATE, data);
  }

  emitAlertNotification(userId: string, alert: any): void {
    this.emitToUser(userId, RealtimeEventType.ALERT_NOTIFICATION, alert);
  }

  emitHeatmapUpdate(data: any): void {
    this.emitEvent(RealtimeEventType.HEATMAP_UPDATE, data);
  }

  emitTradeExecution(data: any): void {
    this.emitEvent(RealtimeEventType.TRADE_EXECUTION, data);
  }

  emitOrderStatusChange(userId: string, data: any): void {
    this.emitToUser(userId, RealtimeEventType.ORDER_STATUS_CHANGE, data);
  }

  emitPriceAlert(userId: string, alert: any): void {
    this.emitToUser(userId, RealtimeEventType.PRICE_ALERT, alert);
  }

  emitSystemNotification(data: any): void {
    this.emitEvent(RealtimeEventType.SYSTEM_NOTIFICATION, data);
  }

  private emitEvent(eventType: RealtimeEventType, data: any): void {
    this.eventEmitter.emit(`websocket.${eventType}`, {
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Emitted event: ${eventType}`);
  }

  private emitToUser(
    userId: string,
    eventType: RealtimeEventType,
    data: any,
  ): void {
    this.eventEmitter.emit(`websocket.user.${userId}.${eventType}`, {
      type: eventType,
      userId,
      data,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Emitted event to user ${userId}: ${eventType}`);
  }
}
