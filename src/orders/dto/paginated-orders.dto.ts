import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../../common/enums/order-type.enum';

export class PaginatedOrdersQueryDto {
  /** Page number (1-indexed). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Items per page (default 20, max 100). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Filter by order status. */
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
