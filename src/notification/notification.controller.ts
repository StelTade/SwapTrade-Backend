import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';
import { GetNotificationsDto, MarkAsReadDto } from './dto/notification.dto';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get(':userId')
  async list(@Param('userId', ParseIntPipe) userId: number) {
    return this.notificationService.findAllByUser(userId);
  }

  @Get(':userId/preferences')
  async getPreferences(@Param('userId', ParseIntPipe) userId: number) {
    return this.notificationService.getPreferences(userId);
  }

  @Post(':userId/preferences')
  async updatePreferences(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: UpdatePreferencesDto,
  ) {
    return this.notificationService.setPreferences({
      userId,
      orderFilled: body.orderFilled ?? false,
      priceAlerts: body.priceAlerts ?? false,
      achievementUnlocked: body.achievementUnlocked ?? false,
    });
  }

  @Post(':userId/event')
  async sendEvent(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('type') type: NotificationEventType,
    @Body('message') message: string,
  ) {
    return this.notificationService.sendEvent(userId, type, message);
  }

  @Patch(':id/read')
  async markRead(@Param('id', ParseIntPipe) id: number) {
    return this.notificationService.markAsRead(id);
  }

  @Get()
  async getNotifications(
    @Req() req: any, // Replace with authenticated user
    @Query() query: GetNotificationsDto
  ) {
    const userId = req.user?.id || 'current-user-id'; // Replace with actual auth
    return await this.notificationService.getNotifications(userId, query);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user?.id || 'current-user-id';
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Post('mark-read')
  async markAsRead(
    @Req() req: any,
    @Body() dto: MarkAsReadDto
  ) {
    const userId = req.user?.id || 'current-user-id';
    // Mark each notification as read
    for (const notificationId of dto.notificationIds) {
      await this.notificationService.markAsRead(parseInt(notificationId));
    }
    return { success: true };
  }

  @Post('mark-all-read')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user?.id || 'current-user-id';
    await this.notificationService.markAllAsRead(userId);
    return { success: true };
  }


}
