
import { IsNumber, IsString, IsOptional, Min, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUserId } from '../../common/validation';

export class UpdateBalanceDto {
  @ApiProperty({ example: 123, description: 'User ID (matches UserBalance.userId)' })
  @IsUserId()
  userId: number;

  @ApiProperty({ example: 1, description: 'Asset ID' })
  @IsNumber()
  @Min(1)
  assetId: number; 

  @ApiProperty({ example: 100.5, description: 'Amount to update (positive = deposit, negative = withdrawal)' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'Deposit for trade', description: 'Reason for balance update' })
  @IsString()
  @MaxLength(255)
  reason: string;

  @ApiPropertyOptional({ example: 'tx_123', description: 'Transaction ID (optional)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  transactionId?: string;

  @ApiPropertyOptional({ example: 'order_456', description: 'Related order ID (optional)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  relatedOrderId?: string;
}
