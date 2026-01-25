import { IsNumber, IsString, IsEnum, MaxLength, MinLength } from 'class-validator';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { IsUserId } from '../../common/validation';

export class SendNotificationDto {
  @IsUserId()
  userId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  type: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message: string;

  @IsEnum(NotificationStatus)
  status: NotificationStatus;
}
