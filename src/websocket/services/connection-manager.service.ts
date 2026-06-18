import { Injectable, Logger } from '@nestjs/common';

export interface ConnectionState {
  clientId: string;
  userId?: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: string[];
  reconnectAttempts: number;
  isAuthenticated: boolean;
  metadata: Record<string, any>;
}

export interface ReconnectionConfig {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
}

@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private connections: Map<string, ConnectionState> = new Map();
  private reconnectionConfig: ReconnectionConfig = {
    maxAttempts: 5,
    backoffMs: 1000,
    maxBackoffMs: 30000,
  };

  registerConnection(
    clientId: string,
    userId?: string,
    metadata: Record<string, any> = {},
  ): ConnectionState {
    const state: ConnectionState = {
      clientId,
      userId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: [],
      reconnectAttempts: 0,
      isAuthenticated: false,
      metadata,
    };

    this.connections.set(clientId, state);
    this.logger.log(`Connection registered: ${clientId}`);
    return state;
  }

  unregisterConnection(clientId: string): void {
    this.connections.delete(clientId);
    this.logger.log(`Connection unregistered: ${clientId}`);
  }

  updateActivity(clientId: string): void {
    const state = this.connections.get(clientId);
    if (state) {
      state.lastActivity = new Date();
    }
  }

  addSubscription(clientId: string, channel: string): void {
    const state = this.connections.get(clientId);
    if (state && !state.subscriptions.includes(channel)) {
      state.subscriptions.push(channel);
    }
  }

  removeSubscription(clientId: string, channel: string): void {
    const state = this.connections.get(clientId);
    if (state) {
      state.subscriptions = state.subscriptions.filter(
        (sub) => sub !== channel,
      );
    }
  }

  markAuthenticated(clientId: string): void {
    const state = this.connections.get(clientId);
    if (state) {
      state.isAuthenticated = true;
    }
  }

  handleReconnection(clientId: string): number {
    const state = this.connections.get(clientId);
    if (!state) {
      return 0;
    }

    state.reconnectAttempts++;
    const attempts = state.reconnectAttempts;

    if (attempts > this.reconnectionConfig.maxAttempts) {
      this.logger.warn(`Max reconnection attempts reached for ${clientId}`);
      return -1;
    }

    // Exponential backoff
    const backoff = Math.min(
      this.reconnectionConfig.backoffMs * Math.pow(2, attempts - 1),
      this.reconnectionConfig.maxBackoffMs,
    );

    this.logger.log(
      `Reconnection attempt ${attempts} for ${clientId}, backoff: ${backoff}ms`,
    );
    return backoff;
  }

  resetReconnection(clientId: string): void {
    const state = this.connections.get(clientId);
    if (state) {
      state.reconnectAttempts = 0;
    }
  }

  getConnectionState(clientId: string): ConnectionState | null {
    return this.connections.get(clientId) || null;
  }

  getActiveConnections(): ConnectionState[] {
    return Array.from(this.connections.values());
  }

  getActiveConnectionsCount(): number {
    return this.connections.size;
  }

  cleanupStaleConnections(timeoutMs: number = 60000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [clientId, state] of this.connections.entries()) {
      const inactiveTime = now - state.lastActivity.getTime();
      if (inactiveTime > timeoutMs) {
        this.connections.delete(clientId);
        cleanedCount++;
        this.logger.log(`Cleaned up stale connection: ${clientId}`);
      }
    }

    return cleanedCount;
  }

  getUserConnections(userId: string): ConnectionState[] {
    return Array.from(this.connections.values()).filter(
      (state) => state.userId === userId,
    );
  }

  getConnectionsByChannel(channel: string): ConnectionState[] {
    return Array.from(this.connections.values()).filter((state) =>
      state.subscriptions.includes(channel),
    );
  }

  getConnectionStats(): any {
    const connections = Array.from(this.connections.values());
    const now = Date.now();

    return {
      totalConnections: connections.length,
      authenticatedConnections: connections.filter((c) => c.isAuthenticated)
        .length,
      averageSessionDuration: this.calculateAverageDuration(connections, now),
      connectionsByChannel: this.countConnectionsByChannel(connections),
    };
  }

  private calculateAverageDuration(
    connections: ConnectionState[],
    now: number,
  ): number {
    if (connections.length === 0) return 0;
    const totalDuration = connections.reduce((sum, conn) => {
      return sum + (now - conn.connectedAt.getTime());
    }, 0);
    return totalDuration / connections.length;
  }

  private countConnectionsByChannel(
    connections: ConnectionState[],
  ): Record<string, number> {
    const channelCounts: Record<string, number> = {};

    for (const conn of connections) {
      for (const channel of conn.subscriptions) {
        channelCounts[channel] = (channelCounts[channel] || 0) + 1;
      }
    }

    return channelCounts;
  }
}
