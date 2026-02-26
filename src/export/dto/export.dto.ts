import { IsString, IsEnum, IsOptional, IsDateString, IsNumber, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum ExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
}

export enum ExportType {
  TRADES = 'trades',
  BALANCES = 'balances',
  BALANCE_HISTORY = 'balance_history',
  ALL = 'all',
}

export class ExportRequestDto {
  @IsEnum(ExportType)
  type: ExportType;

  @IsEnum(ExportFormat)
  format: ExportFormat;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assets?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10000;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number = 0;
}

export class ExportQueryDto {
  @IsOptional()
  @IsEnum(ExportType)
  type?: ExportType;

  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assets?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 1000;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number = 0;
}

export class ExportResponseDto {
  success: boolean;
  message: string;
  downloadUrl?: string;
  filename?: string;
  recordCount?: number;
  fileSize?: string;
  exportType: ExportType;
  format: ExportFormat;
  generatedAt: string;
}
