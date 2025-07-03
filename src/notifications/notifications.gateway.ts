import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verifyJwtToken } from '../utils/jwt.util';

@WebSocketGateway({ namespace: '/notifications', cors: true })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers['authorization']?.split(' ')[1];
      if (!token) throw new Error('No token provided');
      const payload = verifyJwtToken(token);
      const userId = payload.sub || payload.id || payload.userId || payload.email; 
      if (!userId) throw new Error('Invalid token payload');
      client.data.userId = userId;
      client.join(userId.toString());
      console.log(`User ${userId} connected to notifications (${client.id})`);
    } catch (err) {
      console.log('Socket authentication failed:', err.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }
} 