import { IsString, IsOptional, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body for creating a fiat deposit intent or payout. The direction is implied
 * by the endpoint (`/fiat/deposit-intent` vs `/fiat/payout`), so it is not part
 * of the payload.
 */
export class FiatIntentDto {
  @ApiProperty({ example: 100, description: 'Fiat amount' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    default: 'USDC',
    description: 'Ledger asset to credit (deposit) or debit (payout)',
  })
  @IsString()
  @IsOptional()
  asset?: string;
}
