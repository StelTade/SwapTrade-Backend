import { IsNumber, IsString, IsEnum } from 'class-validator';
import { NotificationStatus } from '../../common/enums/notification-status.enum';

export class SendNotificationDto {
  @IsNumber()
  userId: number;

  @IsString()
  type: string;

  @IsString()
  message: string;

  @IsEnum(NotificationStatus)
  status: NotificationStatus;
}
