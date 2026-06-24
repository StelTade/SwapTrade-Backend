import { IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';

/**
 * DTO for requesting a reconciliation report.
 */
export class GenerateReconciliationReportDto {
  @IsUUID()
  institutionalClientId: string;

  @IsDateString()
  reportDate: string;

  @IsOptional()
  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'])
  reportType?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
}

/**
 * DTO for querying reconciliation reports.
 */
export class ReconciliationReportFilterDto {
  @IsOptional()
  @IsUUID()
  institutionalClientId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['PENDING', 'GENERATING', 'COMPLETED', 'FAILED'])
  status?: string;

  @IsOptional()
  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'])
  reportType?: string;
}
