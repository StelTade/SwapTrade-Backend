import { Injectable, Logger } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private pushSubscriptions: Map<string, Set<string>> = new Map(); // userId -> set of socketIds

  registerDevice(userId: string, socketId: string) {
    if (!this.pushSubscriptions.has(userId)) {
      this.pushSubscriptions.set(userId, new Set());
    }
    this.pushSubscriptions.get(userId)!.add(socketId);
    this.logger.log(`User ${userId} registered for push notifications with socket ${socketId}`);
  }

  unregisterDevice(userId: string, socketId: string) {
    if (this.pushSubscriptions.has(userId)) {
      this.pushSubscriptions.get(userId)!.delete(socketId);
      if (this.pushSubscriptions.get(userId)!.size === 0) {
        this.pushSubscriptions.delete(userId);
      }
      this.logger.log(`User ${userId} unregistered from push notifications for socket ${socketId}`);
    }
  }

  async sendPushNotification(notification: Notification, socketServer?: any): Promise<boolean> {
    try {
      const userSubscriptions = this.pushSubscriptions.get(notification.userId);
      
      if (!userSubscriptions || userSubscriptions.size === 0) {
        this.logger.warn(`No active push subscriptions for user ${notification.userId}`);
        return false;
      }

      if (socketServer) {
        const payload = {
          id: notification.id,
          type: notification.type,
          data: notification.data,
          createdAt: notification.createdAt,
        };

        userSubscriptions.forEach(socketId => {
          socketServer.to(socketId).emit('notification', payload);
        });

        this.logger.log(`Push notification sent to user ${notification.userId} to ${userSubscriptions.size} connected devices`);
        return true;
      } else {
        this.logger.warn('Socket server not available for push notifications');
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${notification.userId}`, error.stack);
      throw error;
    }
  }

  getConnectedUsers(): string[] {
    return Array.from(this.pushSubscriptions.keys());
  }

  getActiveConnectionsForUser(userId: string): number {
    return this.pushSubscriptions.get(userId)?.size || 0;
  }
}