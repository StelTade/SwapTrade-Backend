import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BalanceQueryDto {
  @ApiPropertyOptional({
    default: 'USDC',
    description: 'Asset symbol; omit to return all balances',
  })
  @IsString()
  @IsOptional()
  asset?: string;
}
