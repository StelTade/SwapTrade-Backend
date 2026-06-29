import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class CurrentAllocationDto {
  @ApiProperty({ example: 'BTC', description: 'Asset symbol' })
  @IsString()
  symbol: string;

  @ApiProperty({ example: 'Bitcoin', description: 'Asset name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 22500, description: 'Current value of holding' })
  @IsNumber()
  value: number;

  @ApiProperty({ example: 0.5, description: 'Quantity held' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 40000, description: 'Average purchase price' })
  @IsNumber()
  averagePrice: number;

  @ApiProperty({ example: 45, description: 'Current allocation percentage' })
  @IsNumber()
  allocationPercentage: number;
}

export class RebalancingRequestDto {
  @ApiProperty({ type: [CurrentAllocationDto], description: 'Current portfolio allocation' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CurrentAllocationDto)
  currentAllocation: CurrentAllocationDto[];

  @ApiProperty({ example: 50000, description: 'Total current portfolio value' })
  @IsNumber()
  totalPortfolioValue: number;

  @ApiProperty({
    enum: ['conservative', 'moderate', 'aggressive'],
    description: 'User risk tolerance level',
  })
  @IsEnum(['conservative', 'moderate', 'aggressive'])
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Volatility scores for each asset',
    example: {
      BTC: 0.45,
      ETH: 0.55,
      USDT: 0.01,
    },
  })
  assetVolatilities: Record<string, number>;
}