import {
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TradingActivityDto {
  @IsString()
  asset: string;

  @IsString()
  tradeType: string;

  @IsNumber()
  @IsPositive()
  notionalValue: number;

  @IsNumber()
  @Min(1)
  leverage: number;

  @IsOptional()
  @IsNumber()
  realizedPnlPercent?: number;

  @IsOptional()
  @IsString()
  createdAt?: string;
}

export class PortfolioPositionDto {
  @IsString()
  asset: string;

  @IsNumber()
  @Min(0)
  allocationPercent: number;

  @IsOptional()
  @IsNumber()
  volatilityPercent?: number;
}

export class AssistantQueryDto {
  @IsString()
  userId: string;

  @IsString()
  sessionId: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradingActivityDto)
  tradingHistory?: TradingActivityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioPositionDto)
  portfolio?: PortfolioPositionDto[];
}
