import { IsString, IsDateString, IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SarType {
  STRUCTURING = 'structuring',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  TERRORIST_FINANCING = 'terrorist_financing',
  FRAUD = 'fraud',
  MONEY_LAUNDERING = 'money_laundering',
  OTHER = 'other',
}

export enum SarJurisdiction {
  FATF = 'fatf',
  EU_MICA = 'eu_mica',
  US_SEC = 'us_sec',
  UK_FCA = 'uk_fca',
  OTHER = 'other',
}

export class FileSarDto {
  @ApiProperty()
  @IsString()
  subjectUserId: string;

  @ApiProperty({ enum: SarType })
  @IsEnum(SarType)
  sarType: SarType;

  @ApiProperty({ enum: SarJurisdiction })
  @IsEnum(SarJurisdiction)
  jurisdiction: SarJurisdiction;

  @ApiProperty()
  @IsString()
  narrativeSummary: string;

  @ApiProperty()
  @IsDateString()
  activityStartDate: string;

  @ApiProperty()
  @IsDateString()
  activityEndDate: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  relatedTransactionIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalAmountInvolved?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;
}