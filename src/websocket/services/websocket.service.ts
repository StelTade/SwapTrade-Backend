import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { 
  WebSocketClient, 
  WebSocketMessage, 
  WebSocketMessageType, 
  SubscriptionRequest,
  OrderBookUpdate,
  TradeExecuted,
  OrderUpdate,
  BalanceUpdate,
  PortfolioUpdate,
  MarketDataUpdate
} from '../interfaces/websocket.interfaces';
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from '@nestjs/jwt';
import { PrometheusService } from '../common/monitoring/services/prometheus.service';
import { StructuredLoggerService } from '../common/monitoring/services/structured-logger.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.WEBSOCKET_CORS_ORIGIN || '*',
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
})
export class WebSocketService implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WebSocketService.name);
  private clients: Map<string, WebSocketClient> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // channel -> client IDs
  private userSubscriptions: Map<string, Set<string>> = new Map(); // userId -> channels

  constructor(
    private readonly jwtService: JwtService,
    private readonly prometheusService: PrometheusService,
    private readonly structuredLogger: StructuredLoggerService
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.prometheusService.setGauge('websocket_connections_total', 0);
    
    // Set up heartbeat interval
    setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Every 30 seconds
  }

  async handleConnection(client: Socket) {
    const clientId = uuidv4();
    const sessionId = uuidv4();
    
    const wsClient: WebSocketClient = {
      id: clientId,
      sessionId,
      socket: client,
      subscriptions: new Set(),
      authenticated: false,
      lastActivity: new Date(),
      metadata: {
        ip: client.handshake.address,
        userAgent: client.handshake.headers['user-agent'],
        connectedAt: new Date().toISOString()
      }
    };

    this.clients.set(clientId, wsClient);
    client.clientId = clientId;

    // Update metrics
    this.prometheusService.incrementCounter('websocket_connections_total');
    this.prometheusService.setGauge('websocket_active_connections', this.clients.size);

    this.structuredLogger.logWithCorrelation(
      'info',
      `WebSocket client connected: ${clientId}`,
      sessionId,
      {
        clientId,
        ip: client.handshake.address,
        userAgent: client.handshake.headers['user-agent']
      }
    );

    // Send welcome message
    this.sendToClient(clientId, {
      type: WebSocketMessageType.CONNECT,
      data: { clientId, sessionId },
      timestamp: new Date().toISOString()
    });
  }

  async handleDisconnect(client: Socket) {
    const clientId = client.clientId;
    const wsClient = this.clients.get(clientId);

    if (wsClient) {
      // Remove from all subscriptions
      wsClient.subscriptions.forEach(channel => {
        this.unsubscribeFromChannel(clientId, channel);
      });

      // Remove user subscriptions
      if (wsClient.userId) {
        this.userSubscriptions.delete(wsClient.userId);
      }

      this.clients.delete(clientId);

      // Update metrics
      this.prometheusService.setGauge('websocket_active_connections', this.clients.size);

      this.structuredLogger.logWithCorrelation(
        'info',
        `WebSocket client disconnected: ${clientId}`,
      wsClient.sessionId,
      {
        clientId,
        userId: wsClient.userId,
        sessionDuration: Date.now() - wsClient.metadata.connectedAt
      }
      );
    }
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(client: Socket, data: WebSocketAuthData) {
    const clientId = client.clientId;
    const wsClient = this.clients.get(clientId);

    if (!wsClient) {
      return this.sendToClient(clientId, {
        type: WebSocketMessageType.AUTH_FAILED,
        data: { error: 'Client not found' },
        timestamp: new Date().toISOString()
      });
    }

    try {
      const payload = this.jwtService.verify(data.token);
      
      wsClient.userId = payload.sub;
      wsClient.authenticated = true;
      wsClient.userRole = payload.role;
      wsClient.lastActivity = new Date();

      // Restore user subscriptions if any
      this.restoreUserSubscriptions(wsClient.userId, clientId);

      this.structuredLogger.logWithCorrelation(
        'info',
        `WebSocket client authenticated: ${clientId}`,
        wsClient.sessionId,
        {
          clientId,
          userId: wsClient.userId,
          role: wsClient.userRole
        }
      );

      this.sendToClient(clientId, {
        type: WebSocketMessageType.AUTH_SUCCESS,
        data: { userId: wsClient.userId },
        timestamp: new Date().toISOString()
      });

      this.prometheusService.incrementCounter('websocket_authentications_total', { status: 'success' });

    } catch (error) {
      this.structuredLogger.logWithCorrelation(
        'warn',
        `WebSocket authentication failed: ${clientId}`,
        wsClient.sessionId,
        { clientId, error: error.message }
      );

      this.sendToClient(clientId, {
        type: WebSocketMessageType.AUTH_FAILED,
        data: { error: 'Invalid token' },
        timestamp: new Date().toISOString()
      });

      this.prometheusService.incrementCounter('websocket_authentications_total', { status: 'failed' });
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(client: Socket, data: SubscriptionRequest) {
    const clientId = client.clientId;
    const wsClient = this.clients.get(clientId);

    if (!wsClient || !wsClient.authenticated) {
      return this.sendToClient(clientId, {
        type: WebSocketMessageType.ERROR,
        data: { error: 'Authentication required' },
        timestamp: new Date().toISOString()
      });
    }

    const { channels, filters } = data;

    for (const channel of channels) {
      if (this.validateSubscription(wsClient, channel)) {
        this.subscribeToChannel(clientId, channel, filters);
      }
    }

    this.sendToClient(clientId, {
      type: WebSocketMessageType.CONNECT,
      data: { 
        message: 'Subscribed to channels',
        channels: Array.from(wsClient.subscriptions)
      },
      timestamp: new Date().toISOString()
    });
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(client: Socket, data: { channels: string[] }) {
    const clientId = client.clientId;
    const wsClient = this.clients.get(clientId);

    if (!wsClient) {
      return;
    }

    for (const channel of data.channels) {
      this.unsubscribeFromChannel(clientId, channel);
    }

    this.sendToClient(clientId, {
      type: WebSocketMessageType.CONNECT,
      data: { 
        message: 'Unsubscribed from channels',
        channels: Array.from(wsClient.subscriptions)
      },
      timestamp: new Date().toISOString()
    });
  }

  @SubscribeMessage('ping')
  async handlePing(client: Socket) {
    const clientId = client.clientId;
    const wsClient = this.clients.get(clientId);

    if (wsClient) {
      wsClient.lastActivity = new Date();
    }

    this.sendToClient(clientId, {
      type: WebSocketMessageType.PONG,
      data: { timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  }

  // Public methods for broadcasting events
  broadcastOrderBookUpdate(update: OrderBookUpdate) {
    this.broadcastToChannel(`orderbook:${update.asset}`, {
      type: WebSocketMessageType.ORDER_BOOK_UPDATE,
      data: update,
      timestamp: new Date().toISOString()
    });
  }

  broadcastTradeExecution(trade: TradeExecuted) {
    // Broadcast to general trade channel
    this.broadcastToChannel('trades', {
      type: WebSocketMessageType.TRADE_EXECUTED,
      data: trade,
      timestamp: new Date().toISOString()
    });

    // Send to specific users
    this.sendToUser(trade.buyerId, {
      type: WebSocketMessageType.USER_TRADE_EXECUTED,
      data: trade,
      timestamp: new Date().toISOString()
    });

    this.sendToUser(trade.sellerId, {
      type: WebSocketMessageType.USER_TRADE_EXECUTED,
      data: trade,
      timestamp: new Date().toISOString()
    });
  }

  broadcastOrderUpdate(order: OrderUpdate) {
    // Send to the user who placed the order
    this.sendToUser(order.userId, {
      type: WebSocketMessageType.USER_ORDER_UPDATE,
      data: order,
      timestamp: new Date().toISOString()
    });

    // Also broadcast to order book channel if it's a public order
    if (order.status === 'pending' || order.status === 'partially_filled') {
      this.broadcastToChannel(`orders:${order.asset}`, {
        type: WebSocketMessageType.ORDER_PLACED,
        data: order,
        timestamp: new Date().toISOString()
      });
    }
  }

  broadcastBalanceUpdate(update: BalanceUpdate) {
    this.sendToUser(update.userId, {
      type: WebSocketMessageType.BALANCE_UPDATE,
      data: update,
      timestamp: new Date().toISOString()
    });
  }

  broadcastPortfolioUpdate(update: PortfolioUpdate) {
    this.sendToUser(update.userId, {
      type: WebSocketMessageType.PORTFOLIO_UPDATE,
      data: update,
      timestamp: new Date().toISOString()
    });
  }

  broadcastMarketDataUpdate(update: MarketDataUpdate) {
    this.broadcastToChannel(`market:${update.asset}`, {
      type: WebSocketMessageType.MARKET_DATA_UPDATE,
      data: update,
      timestamp: new Date().toISOString()
    });
  }

  broadcastUserAchievement(userId: string, achievement: any) {
    this.sendToUser(userId, {
      type: WebSocketMessageType.USER_ACHIEVEMENT_UNLOCKED,
      data: achievement,
      timestamp: new Date().toISOString()
    });
  }

  broadcastUserTierProgress(userId: string, tierProgress: any) {
    this.sendToUser(userId, {
      type: WebSocketMessageType.USER_TIER_PROGRESS,
      data: tierProgress,
      timestamp: new Date().toISOString()
    });
  }

  broadcastSystemStatus(status: any) {
    this.broadcastToAll({
      type: WebSocketMessageType.SYSTEM_STATUS,
      data: status,
      timestamp: new Date().toISOString()
    });
  }

  broadcastMaintenanceNotice(notice: any) {
    this.broadcastToAll({
      type: WebSocketMessageType.MAINTENANCE_NOTICE,
      data: notice,
      timestamp: new Date().toISOString()
    });
  }

  // Private helper methods
  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (client && client.socket.connected) {
      client.socket.emit('message', message);
      this.prometheusService.incrementCounter('websocket_messages_sent_total', { type: message.type });
    }
  }

  private sendToUser(userId: string, message: WebSocketMessage) {
    const userSubscriptions = this.userSubscriptions.get(userId);
    if (userSubscriptions) {
      for (const clientId of userSubscriptions) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private broadcastToChannel(channel: string, message: WebSocketMessage) {
    const subscribers = this.subscriptions.get(channel);
    if (subscribers) {
      for (const clientId of subscribers) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private broadcastToAll(message: WebSocketMessage) {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  private subscribeToChannel(clientId: string, channel: string, filters?: Record<string, any>) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Add to channel subscriptions
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(clientId);

    // Add to client subscriptions
    client.subscriptions.add(channel);

    // Add to user subscriptions
    if (client.userId) {
      if (!this.userSubscriptions.has(client.userId)) {
        this.userSubscriptions.set(client.userId, new Set());
      }
      this.userSubscriptions.get(client.userId)!.add(clientId);
    }

    this.structuredLogger.logWithCorrelation(
      'info',
      `Client subscribed to channel: ${channel}`,
      client.sessionId,
      {
        clientId,
        userId: client.userId,
        channel,
        filters
      }
    );
  }

  private unsubscribeFromChannel(clientId: string, channel: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from channel subscriptions
    const channelSubs = this.subscriptions.get(channel);
    if (channelSubs) {
      channelSubs.delete(clientId);
      if (channelSubs.size === 0) {
        this.subscriptions.delete(channel);
      }
    }

    // Remove from client subscriptions
    client.subscriptions.delete(channel);
  }

  private validateSubscription(client: WebSocketClient, channel: string): boolean {
    // Check if user has permission to subscribe to this channel
    if (channel.startsWith('admin:') && client.userRole !== 'admin') {
      return false;
    }

    // Add other validation rules as needed
    return true;
  }

  private restoreUserSubscriptions(userId: string, clientId: string) {
    // Restore previous subscriptions for this user
    const userChannels = this.userSubscriptions.get(userId);
    if (userChannels) {
      userChannels.add(clientId);
    }
  }

  private sendHeartbeat() {
    const now = Date.now();
    const timeout = 60000; // 1 minute timeout

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastActivity.getTime() > timeout) {
        // Client hasn't responded to ping, disconnect
        client.socket.disconnect();
      } else {
        // Send ping
        this.sendToClient(clientId, {
          type: WebSocketMessageType.PING,
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Utility methods
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  getAuthenticatedClientsCount(): number {
    return Array.from(this.clients.values()).filter(client => client.authenticated).length;
  }

  getChannelSubscribers(channel: string): number {
    const subscribers = this.subscriptions.get(channel);
    return subscribers ? subscribers.size : 0;
  }

  getStats() {
    return {
      totalConnections: this.clients.size,
      authenticatedConnections: this.getAuthenticatedClientsCount(),
      channels: Object.fromEntries(
        Array.from(this.subscriptions.entries()).map(([channel, subs]) => [channel, subs.size])
      ),
      uptime: process.uptime()
    };
  }
}
