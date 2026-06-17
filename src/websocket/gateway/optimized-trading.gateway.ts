import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConnectionPoolService } from '../services/connection-pool.service';
import { MessageQueueService } from '../services/message-queue.service';
import { EnhancedCacheService } from '../../common/services/enhanced-cache.service';

interface TradeUpdate {
  asset: string;
  price: number;
  volume: number;
  timestamp: Date;
  type: 'BUY' | 'SELL';
}

interface OrderBookUpdate {
  asset: string;
  bids: Array<{ price: number; amount: number }>;
  asks: Array<{ price: number; amount: number }>;
  timestamp: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class OptimizedTradingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OptimizedTradingGateway.name);

  constructor(
    private readonly connectionPool: ConnectionPoolService,
    private readonly messageQueue: MessageQueueService,
    private readonly cacheService: EnhancedCacheService,
  ) {
    this.setupMessageQueueListener();
  }

  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized');

    // Start heartbeat
    setInterval(() => {
      this.connectionPool.sendHeartbeat();
    }, 30000); // Every 30 seconds

    // Log connection stats periodically
    setInterval(() => {
      const stats = this.connectionPool.getConnectionStats();
      this.logger.log('Connection stats:', stats);
    }, 60000); // Every minute

    // Log queue stats periodically
    setInterval(() => {
      const stats = this.messageQueue.getQueueStats();
      this.logger.log('Message queue stats:', stats);
    }, 60000); // Every minute
  }

  handleConnection(client: Socket): void {
    const connectionInfo = this.connectionPool.addConnection(client);

    this.logger.log(`Client connected: ${client.id}`);

    // Send welcome message
    client.emit('connected', {
      message: 'Connected to SwapTrade WebSocket',
      timestamp: new Date().toISOString(),
      connectionId: client.id,
    });

    // Setup client event handlers
    this.setupClientEventHandlers(client);
  }

  handleDisconnect(client: Socket): void {
    this.connectionPool.removeConnection(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('authenticate')
  async handleAuthentication(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string; userId: string },
  ): Promise<void> {
    try {
      // Validate token (simplified for demo)
      if (data.token && data.userId) {
        const success = this.connectionPool.associateUser(
          client.id,
          data.userId,
        );

        if (success) {
          client.emit('authenticated', {
            success: true,
            userId: data.userId,
            timestamp: new Date().toISOString(),
          });

          // Join user-specific room
          this.connectionPool.joinRoom(client.id, `user:${data.userId}`);

          this.logger.log(
            `User ${data.userId} authenticated on connection ${client.id}`,
          );
        } else {
          client.emit('authentication_error', {
            message: 'Connection limit exceeded',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        client.emit('authentication_error', {
          message: 'Invalid credentials',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Authentication error for ${client.id}:`, error);
      client.emit('authentication_error', {
        message: 'Authentication failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('subscribe_trades')
  async handleSubscribeTrades(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { asset?: string; userId?: string },
  ): Promise<void> {
    const connection = this.connectionPool.getConnection(client.id);
    if (!connection) return;

    try {
      if (data.asset) {
        // Subscribe to specific asset trades
        const roomName = `trades:${data.asset}`;
        const success = this.connectionPool.joinRoom(client.id, roomName);

        if (success) {
          client.emit('subscribed', {
            type: 'trades',
            asset: data.asset,
            room: roomName,
            timestamp: new Date().toISOString(),
          });

          // Send recent trades from cache
          const recentTrades = await this.getRecentTrades(data.asset);
          client.emit('recent_trades', {
            asset: data.asset,
            trades: recentTrades,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (data.userId) {
        // Subscribe to user-specific trades
        const roomName = `user_trades:${data.userId}`;
        const success = this.connectionPool.joinRoom(client.id, roomName);

        if (success) {
          client.emit('subscribed', {
            type: 'user_trades',
            userId: data.userId,
            room: roomName,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      this.logger.error(`Subscribe trades error for ${client.id}:`, error);
      client.emit('error', {
        message: 'Failed to subscribe',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('subscribe_orderbook')
  async handleSubscribeOrderBook(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { asset: string },
  ): Promise<void> {
    const connection = this.connectionPool.getConnection(client.id);
    if (!connection) return;

    try {
      const roomName = `orderbook:${data.asset}`;
      const success = this.connectionPool.joinRoom(client.id, roomName);

      if (success) {
        client.emit('subscribed', {
          type: 'orderbook',
          asset: data.asset,
          room: roomName,
          timestamp: new Date().toISOString(),
        });

        // Send current order book from cache
        const orderBook = await this.cacheService.getOrderBook(data.asset);
        if (orderBook) {
          client.emit('orderbook_update', {
            asset: data.asset,
            orderBook,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      this.logger.error(`Subscribe orderbook error for ${client.id}:`, error);
      client.emit('error', {
        message: 'Failed to subscribe to order book',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ): Promise<void> {
    try {
      this.connectionPool.leaveRoom(client.id, data.room);
      client.emit('unsubscribed', {
        room: data.room,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Unsubscribe error for ${client.id}:`, error);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    client.emit('pong', {
      timestamp: new Date().toISOString(),
      serverTime: Date.now(),
    });
  }

  /**
   * Broadcast trade update to relevant subscribers
   */
  broadcastTradeUpdate(tradeUpdate: TradeUpdate): void {
    // Queue message with high priority for real-time updates
    this.messageQueue.queueMessage(
      `trades:${tradeUpdate.asset}`,
      'trade_update',
      tradeUpdate,
      'high',
    );

    // Also broadcast to user-specific room if userId is available
    if (tradeUpdate.type === 'BUY') {
      this.messageQueue.queueMessage(
        `user_trades:${tradeUpdate.asset}`,
        'trade_update',
        tradeUpdate,
        'high',
      );
    }

    // Invalidate relevant cache
    this.cacheService.invalidateMarketCache(tradeUpdate.asset);
  }

  /**
   * Broadcast order book update
   */
  broadcastOrderBookUpdate(orderBookUpdate: OrderBookUpdate): void {
    // Queue message with high priority
    this.messageQueue.queueMessage(
      `orderbook:${orderBookUpdate.asset}`,
      'orderbook_update',
      orderBookUpdate,
      'high',
    );

    // Update cache
    this.cacheService.setOrderBook(orderBookUpdate.asset, orderBookUpdate);
  }

  /**
   * Setup message queue listener
   */
  private setupMessageQueueListener(): void {
    this.messageQueue.on('processMessage', (message) => {
      this.connectionPool.broadcastToRoom(
        message.room,
        message.event,
        message.data,
      );
    });
  }

  /**
   * Setup client event handlers
   */
  private setupClientEventHandlers(client: Socket): void {
    client.on('error', (error) => {
      this.logger.error(`Client error ${client.id}:`, error);
    });

    client.on('disconnect', (reason) => {
      this.logger.log(`Client disconnect ${client.id}: ${reason}`);
    });
  }

  /**
   * Get recent trades for an asset
   */
  private async getRecentTrades(asset: string): Promise<TradeUpdate[]> {
    try {
      // This would typically query the database
      // For now, return mock data
      return [
        {
          asset,
          price: 45000,
          volume: 0.1,
          timestamp: new Date(),
          type: 'BUY',
        },
        {
          asset,
          price: 44950,
          volume: 0.05,
          timestamp: new Date(Date.now() - 1000),
          type: 'SELL',
        },
      ];
    } catch (error) {
      this.logger.error(`Error getting recent trades for ${asset}:`, error);
      return [];
    }
  }

  /**
   * Get gateway statistics
   */
  getGatewayStats(): any {
    return {
      connections: this.connectionPool.getConnectionStats(),
      messageQueue: this.messageQueue.getQueueStats(),
      cacheStats: this.cacheService.getCacheStats(),
      serverTime: new Date().toISOString(),
    };
  }
}
