import { IsOptional, IsBoolean, IsString, IsObject, IsArray } from 'class-validator';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';

interface ChannelPreferenceDto {
  enabled: boolean;
}

interface EventPreferenceUpdateDto {
  [NotificationChannel.EMAIL]?: ChannelPreferenceDto;
  [NotificationChannel.SMS]?: ChannelPreferenceDto;
  [NotificationChannel.PUSH]?: ChannelPreferenceDto;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsObject()
  preferences?: Partial<{
    [key in NotificationEventType]?: EventPreferenceUpdateDto;
  }>;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsArray()
  pushDeviceTokens?: string[];

  @IsOptional()
  @IsBoolean()
  allNotificationsEnabled?: boolean;
}