import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WebSocketAuthGuard } from '../guards/websocket-auth.guard';
import { WebSocketService } from '../services/websocket.service';
import { 
  WebSocketMessage, 
  WebSocketMessageType,
  SubscriptionRequest 
} from '../interfaces/websocket.interfaces';

@WebSocketGateway({
  namespace: '/trading',
  cors: {
    origin: process.env.WEBSOCKET_CORS_ORIGIN || '*',
    credentials: true
  }
})
@UseGuards(WebSocketAuthGuard)
export class TradingGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly websocketService: WebSocketService) {}

  @SubscribeMessage('subscribe_trading')
  async handleTradingSubscribe(
    @MessageBody() data: SubscriptionRequest,
    @ConnectedSocket() client: Socket
  ) {
    const clientId = client.clientId;
    
    // Validate trading-specific channels
    const validChannels = [
      'orderbook:*',
      'trades',
      'orders:*',
      'market:*',
      'user:*'
    ];

    const filteredChannels = data.channels.filter(channel => {
      return validChannels.some(pattern => 
        pattern.endsWith('*') 
          ? channel.startsWith(pattern.slice(0, -1))
          : channel === pattern
      );
    });

    if (filteredChannels.length === 0) {
      throw new WsException('Invalid trading channels');
    }

    // Subscribe to filtered channels
    await this.websocketService.handleSubscribe(client, {
      channels: filteredChannels,
      filters: data.filters
    });

    return {
      type: WebSocketMessageType.CONNECT,
      data: { 
        message: 'Subscribed to trading channels',
        channels: filteredChannels
      },
      timestamp: new Date().toISOString()
    };
  }

  @SubscribeMessage('get_orderbook')
  async handleGetOrderBook(
    @MessageBody() data: { asset: string },
    @ConnectedSocket() client: Socket
  ) {
    // This would fetch current order book from trading service
    // For now, return a mock response
    return {
      type: WebSocketMessageType.ORDER_BOOK_UPDATE,
      data: {
        asset: data.asset,
        bids: [
          { price: 100.5, amount: 1000, count: 5 },
          { price: 100.4, amount: 500, count: 3 }
        ],
        asks: [
          { price: 100.6, amount: 800, count: 4 },
          { price: 100.7, amount: 1200, count: 6 }
        ],
        timestamp: new Date().toISOString(),
        sequence: 12345
      },
      timestamp: new Date().toISOString()
    };
  }

  @SubscribeMessage('get_market_data')
  async handleGetMarketData(
    @MessageBody() data: { asset: string },
    @ConnectedSocket() client: Socket
  ) {
    // This would fetch market data from market service
    return {
      type: WebSocketMessageType.MARKET_DATA_UPDATE,
      data: {
        asset: data.asset,
        price: 100.55,
        change24h: 2.5,
        volume24h: 50000,
        high24h: 102.0,
        low24h: 99.0,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
  }

  @SubscribeMessage('get_user_trades')
  async handleGetUserTrades(
    @MessageBody() data: { limit?: number },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.userId;
    
    // This would fetch user's recent trades from trading service
    return {
      type: WebSocketMessageType.USER_TRADE_EXECUTED,
      data: {
        trades: [
          {
            id: 'trade_123',
            asset: 'XLM',
            amount: 100,
            price: 100.5,
            type: 'buy',
            timestamp: new Date().toISOString(),
            fee: 0.1
          }
        ]
      },
      timestamp: new Date().toISOString()
    };
  }

  @SubscribeMessage('get_user_orders')
  async handleGetUserOrders(
    @MessageBody() data: { status?: string; limit?: number },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.userId;
    
    // This would fetch user's orders from trading service
    return {
      type: WebSocketMessageType.USER_ORDER_UPDATE,
      data: {
        orders: [
          {
            id: 'order_456',
            asset: 'XLM',
            type: 'buy',
            amount: 200,
            price: 100.0,
            filled: 100,
            remaining: 100,
            status: 'partially_filled',
            timestamp: new Date().toISOString()
          }
        ]
      },
      timestamp: new Date().toISOString()
    };
  }
}
