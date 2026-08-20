import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RefundReason, DisputeReason } from '../enums/escrow.enums';

/**
 * DTO for manually settling an escrow from the admin panel.
 */
export class ManualSettleDto {
  @ApiProperty({ description: 'Escrow account id to settle' })
  @IsString()
  escrowAccountId: string;

  @ApiPropertyOptional({ description: 'Amount to settle (defaults to full remaining balance)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Admin notes for the manual settlement' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Admin user id performing the action' })
  @IsNumber()
  adminUserId: number;
}

/**
 * DTO for manually refunding an escrow from the admin panel.
 */
export class ManualRefundDto {
  @ApiProperty({ description: 'Escrow account id to refund' })
  @IsString()
  escrowAccountId: string;

  @ApiPropertyOptional({ description: 'Amount to refund (defaults to full remaining balance)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({ enum: RefundReason, description: 'Reason code for the refund' })
  @IsEnum(RefundReason)
  reasonCode: RefundReason;

  @ApiPropertyOptional({ description: 'Free-text explanation for the refund' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Admin user id performing the action' })
  @IsNumber()
  adminUserId: number;
}

/**
 * DTO for raising a dispute on an escrow account.
 */
export class RaiseDisputeDto {
  @ApiProperty({ description: 'Escrow account id to dispute' })
  @IsString()
  escrowAccountId: string;

  @ApiProperty({ enum: DisputeReason, description: 'Reason category for the dispute' })
  @IsEnum(DisputeReason)
  reason: DisputeReason;

  @ApiProperty({ description: 'Free-text description of the dispute' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'User id raising the dispute' })
  @IsNumber()
  raisedBy: number;
}

/**
 * DTO for resolving a dispute from the admin panel.
 */
export class ResolveDisputeDto {
  @ApiProperty({ description: 'Escrow account id to resolve' })
  @IsString()
  escrowAccountId: string;

  @ApiProperty({
    enum: ['SETTLE', 'REFUND'],
    description: 'Resolution action: SETTLE releases to counterparty, REFUND returns to depositor',
  })
  @IsEnum(['SETTLE', 'REFUND'])
  resolution: 'SETTLE' | 'REFUND';

  @ApiPropertyOptional({ description: 'Amount to settle/refund (defaults to full remaining balance)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Admin notes explaining the resolution' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Admin user id performing the resolution' })
  @IsNumber()
  adminUserId: number;
}

/**
 * DTO for creating a new escrow from a matched swap.
 */
export class CreateEscrowDto {
  @ApiProperty({ description: 'Unique swap identifier' })
  @IsString()
  swapId: string;

  @ApiProperty({ description: 'User id depositing funds into escrow' })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'Asset id being escrowed' })
  @IsNumber()
  assetId: number;

  @ApiProperty({ description: 'Amount to escrow' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Order id for this side of the swap' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Counterparty order id' })
  @IsOptional()
  @IsString()
  counterpartyOrderId?: string;

  @ApiPropertyOptional({ description: 'Counterparty user id' })
  @IsOptional()
  @IsNumber()
  counterpartyUserId?: number;

  @ApiPropertyOptional({ description: 'Agreed price at match time' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  agreedPrice?: number;
}

/**
 * DTO for querying escrow accounts with filters.
 */
export class EscrowQueryDto {
  @ApiPropertyOptional({ description: 'Filter by swap id' })
  @IsOptional()
  @IsString()
  swapId?: string;

  @ApiPropertyOptional({ description: 'Filter by user id' })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({ description: 'Filter by escrow status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
