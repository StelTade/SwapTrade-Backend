import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationChannel } from './entities/notification.entity';

interface UpdatePreferenceDto {
  type: string;
  channel: NotificationChannel;
  enabled: boolean;
}

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  send(@Body() dto: SendNotificationDto) {
    return this.notificationService.send(dto);
  }

  @Get('preferences/:userId')
  getPreferences(@Param('userId') userId: string): Promise<NotificationPreference[]> {
    return this.notificationService.getPreferences(Number(userId));
  }

  @Patch('preferences/:userId')
  updatePreferences(
    @Param('userId') userId: string,
    @Body() body: UpdatePreferenceDto[],
  ) {
    return this.notificationService.updatePreferences(Number(userId), body);
  }

  @Get('unsubscribe')
  unsubscribe(@Query('token') token: string) {
    return this.notificationService.unsubscribeByToken(token);
  }
}
