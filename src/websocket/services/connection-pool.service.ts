import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface ConnectionInfo {
  socket: Socket;
  userId?: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  roomCount: number;
  messageCount: number;
}

interface RoomInfo {
  name: string;
  clients: Set<string>;
  createdAt: Date;
  lastMessage: Date;
  messageCount: number;
}

@Injectable()
export class ConnectionPoolService {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private readonly connections = new Map<string, ConnectionInfo>();
  private readonly rooms = new Map<string, RoomInfo>();
  private readonly MAX_CONNECTIONS_PER_USER = 10;
  private readonly MAX_ROOMS_PER_CONNECTION = 50;
  private readonly CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupInactiveConnections(), 60000); // Every minute
  }

  /**
   * Add new connection to pool
   */
  addConnection(socket: Socket): ConnectionInfo {
    const connectionInfo: ConnectionInfo = {
      socket,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
      roomCount: 0,
      messageCount: 0,
    };

    this.connections.set(socket.id, connectionInfo);

    this.logger.log(
      `Connection added: ${socket.id} (total: ${this.connections.size})`,
    );

    return connectionInfo;
  }

  /**
   * Remove connection from pool
   */
  removeConnection(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      // Leave all rooms
      connection.subscriptions.forEach((room) => {
        this.leaveRoom(socketId, room);
      });

      this.connections.delete(socketId);
      this.logger.log(
        `Connection removed: ${socketId} (total: ${this.connections.size})`,
      );
    }
  }

  /**
   * Associate user with connection
   */
  associateUser(socketId: string, userId: string): boolean {
    const connection = this.connections.get(socketId);
    if (!connection) return false;

    // Check user connection limit
    const userConnections = this.getUserConnectionCount(userId);
    if (userConnections >= this.MAX_CONNECTIONS_PER_USER) {
      this.logger.warn(
        `User ${userId} exceeded connection limit (${userConnections})`,
      );
      return false;
    }

    connection.userId = userId;
    this.logger.log(`User ${userId} associated with connection ${socketId}`);
    return true;
  }

  /**
   * Join room with rate limiting
   */
  joinRoom(socketId: string, roomName: string): boolean {
    const connection = this.connections.get(socketId);
    if (!connection) return false;

    if (connection.roomCount >= this.MAX_ROOMS_PER_CONNECTION) {
      this.logger.warn(`Connection ${socketId} exceeded room limit`);
      return false;
    }

    // Add to room
    let room = this.rooms.get(roomName);
    if (!room) {
      room = {
        name: roomName,
        clients: new Set(),
        createdAt: new Date(),
        lastMessage: new Date(),
        messageCount: 0,
      };
      this.rooms.set(roomName, room);
    }

    room.clients.add(socketId);
    connection.subscriptions.add(roomName);
    connection.roomCount++;

    this.logger.debug(`Connection ${socketId} joined room ${roomName}`);
    return true;
  }

  /**
   * Leave room
   */
  leaveRoom(socketId: string, roomName: string): void {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    const room = this.rooms.get(roomName);
    if (room) {
      room.clients.delete(socketId);
      connection.subscriptions.delete(roomName);
      connection.roomCount--;

      // Clean up empty rooms
      if (room.clients.size === 0) {
        this.rooms.delete(roomName);
        this.logger.debug(`Room ${roomName} cleaned up (empty)`);
      }
    }

    this.logger.debug(`Connection ${socketId} left room ${roomName}`);
  }

  /**
   * Broadcast message to room with optimization
   */
  broadcastToRoom(roomName: string, event: string, data: any): void {
    const room = this.rooms.get(roomName);
    if (!room || room.clients.size === 0) return;

    const startTime = Date.now();
    let sentCount = 0;

    room.clients.forEach((socketId) => {
      const connection = this.connections.get(socketId);
      if (connection && connection.socket.connected) {
        connection.socket.emit(event, data);
        connection.messageCount++;
        sentCount++;
      }
    });

    room.lastMessage = new Date();
    room.messageCount++;

    const duration = Date.now() - startTime;
    this.logger.debug(
      `Broadcast to room ${roomName}: ${sentCount} clients in ${duration}ms`,
    );
  }

  /**
   * Send heartbeat to all connections
   */
  sendHeartbeat(): void {
    const heartbeatData = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      serverTime: Date.now(),
    };

    let activeCount = 0;
    this.connections.forEach((connection, socketId) => {
      if (connection.socket.connected) {
        connection.socket.emit('heartbeat', heartbeatData);
        connection.lastActivity = new Date();
        activeCount++;
      }
    });

    this.logger.debug(`Heartbeat sent to ${activeCount} connections`);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    totalRooms: number;
    averageRoomsPerConnection: number;
    topActiveRooms: Array<{ name: string; clients: number; messages: number }>;
    userConnectionCounts: Array<{ userId: string; connections: number }>;
  } {
    const activeConnections = Array.from(this.connections.values()).filter(
      (conn) => conn.socket.connected,
    ).length;

    const totalRooms = this.rooms.size;
    const averageRoomsPerConnection =
      this.connections.size > 0
        ? Array.from(this.connections.values()).reduce(
            (sum, conn) => sum + conn.roomCount,
            0,
          ) / this.connections.size
        : 0;

    // Top active rooms
    const topActiveRooms = Array.from(this.rooms.values())
      .sort((a, b) => b.clients.size - a.clients.size)
      .slice(0, 10)
      .map((room) => ({
        name: room.name,
        clients: room.clients.size,
        messages: room.messageCount,
      }));

    // User connection counts
    const userConnectionMap = new Map<string, number>();
    this.connections.forEach((connection) => {
      if (connection.userId) {
        userConnectionMap.set(
          connection.userId,
          (userConnectionMap.get(connection.userId) || 0) + 1,
        );
      }
    });

    const userConnectionCounts = Array.from(userConnectionMap.entries())
      .map(([userId, connections]) => ({ userId, connections }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);

    return {
      totalConnections: this.connections.size,
      activeConnections,
      totalRooms,
      averageRoomsPerConnection,
      topActiveRooms,
      userConnectionCounts,
    };
  }

  /**
   * Clean up inactive connections
   */
  private cleanupInactiveConnections(): void {
    const now = Date.now();
    let cleanedCount = 0;

    this.connections.forEach((connection, socketId) => {
      if (
        !connection.socket.connected ||
        now - connection.lastActivity.getTime() > this.CONNECTION_TIMEOUT
      ) {
        // Leave all rooms
        connection.subscriptions.forEach((room) => {
          this.leaveRoom(socketId, room);
        });

        // Disconnect socket if still connected
        if (connection.socket.connected) {
          connection.socket.disconnect(true);
        }

        this.connections.delete(socketId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} inactive connections`);
    }
  }

  /**
   * Get connection count for user
   */
  private getUserConnectionCount(userId: string): number {
    let count = 0;
    this.connections.forEach((connection) => {
      if (connection.userId === userId && connection.socket.connected) {
        count++;
      }
    });
    return count;
  }

  /**
   * Get connection info
   */
  getConnection(socketId: string): ConnectionInfo | undefined {
    return this.connections.get(socketId);
  }

  /**
   * Get room info
   */
  getRoom(roomName: string): RoomInfo | undefined {
    return this.rooms.get(roomName);
  }

  /**
   * Get all connections for user
   */
  getUserConnections(userId: string): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.userId === userId && conn.socket.connected,
    );
  }
}
