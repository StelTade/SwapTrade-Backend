import { Controller, Get, Query, Patch, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ActiveUser } from '../auth/decorators/activeUser.decorator';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @ActiveUser('sub') userId: number,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('read') read?: string,
  ) {
    return this.notificationsService.getUserNotifications(
      userId.toString(),
      Number(page),
      Number(limit),
      read !== undefined ? read === 'true' : undefined,
    );
  }

  @Patch('read')
  async markAsRead(
    @ActiveUser('sub') userId: number,
    @Body('notificationIds') notificationIds: string[],
  ) {
    await this.notificationsService.markAsRead(userId.toString(), notificationIds);
    return { success: true };
  }
} 