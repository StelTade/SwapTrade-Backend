import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get(':userId')
  async list(@Param('userId', ParseIntPipe) userId: number) {
    return this.notificationService.listUserNotifications(userId);
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
      orderFilled: body.orderFilled,
      priceAlerts: body.priceAlerts,
      achievementUnlocked: body.achievementUnlocked,
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
    return this.notificationService.markRead(id);
  }
}
