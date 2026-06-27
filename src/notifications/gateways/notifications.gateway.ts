import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PushService } from '../services/push.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSocketMap: Map<string, string> = new Map(); // socketId -> userId

  constructor(
    private readonly pushService: PushService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.query.token;
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub;
      this.userSocketMap.set(client.id, userId);
      this.pushService.registerDevice(userId, client.id);

      this.logger.log(`Client ${client.id} connected for user ${userId}`);
      client.emit('connected', { success: true, userId });
    } catch (error) {
      this.logger.error(
        `Failed to authenticate client ${client.id}`,
        error.stack,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.userSocketMap.get(client.id);
    if (userId) {
      this.pushService.unregisterDevice(userId, client.id);
      this.userSocketMap.delete(client.id);
      this.logger.log(`Client ${client.id} disconnected for user ${userId}`);
    }
  }

  @SubscribeMessage('mark_read')
  handleMarkRead(client: Socket, notificationId: string) {
    this.logger.log(`Notification ${notificationId} marked as read by user`);
    client.emit('notification_read', { notificationId });
  }

  getServer(): Server {
    return this.server;
  }
}
