import { IsEnum, IsOptional, IsBoolean, IsArray, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '../entities/notification-event.entity';
import { NotificationChannel, NotificationFrequency } from '../entities/user-notification-preferences.entity';

export class GetNotificationsDto {
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  read?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsEnum(NotificationFrequency)
  frequency?: NotificationFrequency;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @IsOptional()
  @IsBoolean()
  tradeNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  balanceNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  milestoneNotifications?: boolean;
}

export class MarkAsReadDto {
  @IsArray()
  notificationIds: string[];
}