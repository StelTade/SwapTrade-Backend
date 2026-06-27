import { IsNotEmpty, IsUUID } from 'class-validator';

export class MarkNotificationReadDto {
  @IsNotEmpty()
  @IsUUID()
  notificationId: string;
}
