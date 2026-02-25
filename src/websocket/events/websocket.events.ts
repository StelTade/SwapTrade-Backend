import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketService } from '../services/websocket.service';
import { 
  OrderBookUpdate,
  TradeExecuted,
  OrderUpdate,
  BalanceUpdate,
  PortfolioUpdate,
  MarketDataUpdate
} from '../interfaces/websocket.interfaces';

@Injectable()
export class WebSocketEvents {
  constructor(private readonly websocketService: WebSocketService) {}

  @OnEvent('trading.orderbook.updated')
  handleOrderBookUpdate(orderBook: OrderBookUpdate) {
    this.websocketService.broadcastOrderBookUpdate(orderBook);
  }

  @OnEvent('trading.trade.executed')
  handleTradeExecuted(trade: TradeExecuted) {
    this.websocketService.broadcastTradeExecution(trade);
  }

  @OnEvent('trading.order.updated')
  handleOrderUpdate(order: OrderUpdate) {
    this.websocketService.broadcastOrderUpdate(order);
  }

  @OnEvent('user.balance.updated')
  handleBalanceUpdate(balance: BalanceUpdate) {
    this.websocketService.broadcastBalanceUpdate(balance);
  }

  @OnEvent('user.portfolio.updated')
  handlePortfolioUpdate(portfolio: PortfolioUpdate) {
    this.websocketService.broadcastPortfolioUpdate(portfolio);
  }

  @OnEvent('market.data.updated')
  handleMarketDataUpdate(marketData: MarketDataUpdate) {
    this.websocketService.broadcastMarketDataUpdate(marketData);
  }

  @OnEvent('user.achievement.unlocked')
  handleUserAchievement(data: { userId: string; achievement: any }) {
    this.websocketService.broadcastUserAchievement(data.userId, data.achievement);
  }

  @OnEvent('user.tier.progressed')
  handleUserTierProgress(data: { userId: string; tierProgress: any }) {
    this.websocketService.broadcastUserTierProgress(data.userId, data.tierProgress);
  }

  @OnEvent('system.status.changed')
  handleSystemStatus(status: any) {
    this.websocketService.broadcastSystemStatus(status);
  }

  @OnEvent('system.maintenance.scheduled')
  handleMaintenanceNotice(notice: any) {
    this.websocketService.broadcastMaintenanceNotice(notice);
  }
}
