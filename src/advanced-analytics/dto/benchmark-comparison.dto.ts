import { IsArray, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BenchmarkComparisonRequestDto {
  @ApiProperty({
    example: [0.01, -0.005, 0.02, 0.015, -0.01],
    description: 'Array of daily portfolio returns',
  })
  @IsArray()
  @IsNumber({}, { each: true })
  portfolioReturns: number[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'number' } },
    description: 'Historical prices for benchmarks (BTC, ETH, etc.)',
    example: {
      BTC: [42000, 42500, 42300, 43000, 42800],
      ETH: [2200, 2250, 2230, 2300, 2280],
    },
  })
  benchmarkPrices: Record<string, number[]>;
}