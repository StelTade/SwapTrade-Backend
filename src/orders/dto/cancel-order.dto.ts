import { IsUUID } from 'class-validator';

export class CancelOrderDto {
  @IsUUID()
  orderId: string;
}
