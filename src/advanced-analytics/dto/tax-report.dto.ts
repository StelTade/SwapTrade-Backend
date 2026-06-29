import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class TradeDto {
  @ApiProperty({ example: 'trade_123', description: 'Unique trade identifier' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'BTC', description: 'Asset symbol' })
  @IsString()
  asset: string;

  @ApiProperty({ example: 0.5, description: 'Quantity traded' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 45000, description: 'Price at execution' })
  @IsNumber()
  price: number;

  @ApiProperty({ enum: ['BUY', 'SELL'], description: 'Trade side' })
  @IsEnum(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Trade execution date' })
  @IsDateString()
  date: string;
}

export class TaxReportRequestDto {
  @ApiProperty({ type: [TradeDto], description: 'List of all trades in the period' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradeDto)
  trades: TradeDto[];

  @ApiProperty({ example: '2024-01-01T00:00:00Z', description: 'Start of tax period' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-12-31T23:59:59Z', description: 'End of tax period' })
  @IsDateString()
  endDate: string;
}