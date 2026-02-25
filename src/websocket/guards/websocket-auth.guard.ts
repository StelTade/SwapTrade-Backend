import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { WebSocketAuthData } from '../interfaces/websocket.interfaces';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();

    try {
      // Check if client is already authenticated
      if (client.authenticated) {
        return true;
      }

      // Extract token from auth data or headers
      const token = this.extractToken(client, data);
      
      if (!token) {
        throw new WsException('Unauthorized: No token provided');
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      
      // Attach user info to client
      client.userId = payload.sub;
      client.authenticated = true;
      client.userRole = payload.role;
      client.lastActivity = new Date();

      return true;
    } catch (error) {
      throw new WsException('Unauthorized: Invalid token');
    }
  }

  private extractToken(client: any, data: any): string | null {
    // Try to get token from message data first
    if (data && data.token) {
      return data.token;
    }

    // Try to get token from handshake headers
    if (client.handshake && client.handshake.auth && client.handshake.auth.token) {
      return client.handshake.auth.token;
    }

    // Try to get token from query parameters
    if (client.handshake && client.handshake.query && client.handshake.query.token) {
      return client.handshake.query.token;
    }

    // Try to get token from authorization header
    if (client.handshake && client.handshake.headers && client.handshake.headers.authorization) {
      const authHeader = client.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
    }

    return null;
  }
}
