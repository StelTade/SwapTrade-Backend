import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class AnalyticsRequestDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  benchmark?: string;

  @IsOptional()
  @IsBoolean()
  includeRecommendations?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeHistorical?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeRiskMetrics?: boolean = true;

  @IsOptional()
  @IsString()
  timeHorizon?: string;

  @IsOptional()
  @IsEnum(['1D', '1W', '1M', '3M', '6M', '1Y'])
  historicalPeriod?: string;
}

export class HistoricalPerformanceDto {
  @IsString()
  userId: string;

  @IsEnum(['1D', '1W', '1M', '3M', '6M', '1Y'])
  period: string;

  @IsOptional()
  @IsString()
  benchmark?: string;
}

export class RiskMetricsDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsEnum(['1D', '5D', '10D', '30D'])
  timeHorizon?: string = '1D';

  @IsOptional()
  @IsEnum([0.90, 0.95, 0.99])
  confidence?: number = 0.95;
}

export class BenchmarkComparisonDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  benchmark?: string = 'XLM';

  @IsOptional()
  @IsEnum(['1D', '1W', '1M', '3M', '6M', '1Y'])
  period?: string = '1M';
}

export class PortfolioSummaryDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsBoolean()
  includeRecommendations?: boolean = false;
}
