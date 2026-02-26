import { IsNumber, IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { NotificationChannel } from '../entities/notification.entity';

export class SendNotificationDto {
  @IsNumber()
  userId: number;

  @IsString()
  type: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];
}
