import { IsNumber, IsString, IsOptional, Min, MaxLength, IsUUID } from 'class-validator';
import { IsUserId } from '../../common/validation';

export class UpdateBalanceDto {
  @IsUserId()
  userId: number; // matches UserBalance.userId

  @IsNumber()
  @Min(1)
  assetId: number; 

  @IsNumber()
  amount: number; // positive = deposit, negative = withdrawal

  @IsString()
  @MaxLength(255)
  reason: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  transactionId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  relatedOrderId?: string;
}
