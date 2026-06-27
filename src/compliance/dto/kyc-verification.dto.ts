import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum KycProvider {
  ONFIDO = 'onfido',
  JUMIO = 'jumio',
}

export enum KycStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum KycDocumentType {
  PASSPORT = 'passport',
  DRIVING_LICENSE = 'driving_license',
  NATIONAL_ID = 'national_id',
}

export class InitiateKycDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty()
  @IsString()
  nationality: string;

  @ApiPropertyOptional({ enum: KycProvider })
  @IsOptional()
  @IsEnum(KycProvider)
  provider?: KycProvider;

  @ApiPropertyOptional({ enum: KycDocumentType })
  @IsOptional()
  @IsEnum(KycDocumentType)
  documentType?: KycDocumentType;
}

export class KycWebhookDto {
  @ApiProperty()
  @IsString()
  checkId: string;

  @ApiProperty()
  @IsString()
  applicantId: string;

  @ApiProperty({ enum: KycStatus })
  @IsEnum(KycStatus)
  status: KycStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  breakdown?: Record<string, unknown>;
}
