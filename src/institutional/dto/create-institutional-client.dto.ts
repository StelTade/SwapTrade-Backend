import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsPositive,
  IsArray,
  IsUrl,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for registering a new institutional client profile.
 */
export class CreateInstitutionalClientDto {
  @IsInt()
  userId: number;

  @IsString()
  companyName: string;

  @IsOptional()
  @IsString()
  lei?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsInt()
  accountManagerId?: number;

  @IsOptional()
  @IsEnum(['PLATINUM', 'GOLD', 'SILVER'])
  slaTier?: 'PLATINUM' | 'GOLD' | 'SILVER';

  @IsOptional()
  @IsInt()
  @Min(10)
  maxTradesPerSecond?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  maxApiRequestsPerSecond?: number;

  @IsOptional()
  @IsPositive()
  dailyVolumeLimit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}
