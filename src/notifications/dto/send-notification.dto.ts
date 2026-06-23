import { IsNotEmpty, IsString, IsObject, IsOptional, IsUUID } from 'class-validator';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';

export class SendNotificationDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  type: NotificationEventType;

  @IsNotEmpty()
  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  forceChannels?: NotificationChannel[];
}