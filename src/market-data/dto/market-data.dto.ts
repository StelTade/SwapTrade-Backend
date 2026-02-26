import { IsString, IsNumber, IsOptional, IsEnum, IsArray, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class MarketDataDto {
  @IsString()
  symbol: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  volume?: number;

  @IsDateString()
  timestamp: string;

  @IsString()
  source: string;
}

export class SubscribePairsDto {
  @IsArray()
  @IsString({ each: true })
  pairs: string[];
}

export class MarketDataQueryDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number = 0;
}

export class MarketDataUpdateDto {
  @IsString()
  symbol: string;

  @IsNumber()
  currentPrice: number;

  @IsOptional()
  @IsNumber()
  previousPrice?: number;

  @IsOptional()
  @IsNumber()
  priceChange24h?: number;

  @IsOptional()
  @IsNumber()
  volume24h?: number;

  @IsOptional()
  @IsNumber()
  marketCap?: number;

  @IsOptional()
  @IsNumber()
  poolReserveA?: number;

  @IsOptional()
  @IsNumber()
  poolReserveB?: number;

  @IsOptional()
  @IsNumber()
  feeRate?: number;
}
