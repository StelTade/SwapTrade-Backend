import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  KycDocumentStatus,
  KycDocumentType,
} from '../entities/kyc-document.entity';

export class UploadKycDocumentDto {
  @ApiProperty({
    enum: KycDocumentType,
    example: KycDocumentType.PASSPORT,
    description: 'Type of the KYC document being uploaded',
  })
  @IsEnum(KycDocumentType)
  documentType: KycDocumentType;
}

export class ReviewKycDocumentDto {
  @ApiProperty({
    enum: KycDocumentStatus,
    example: KycDocumentStatus.APPROVED,
    description: 'New status for the document',
  })
  @IsEnum(KycDocumentStatus)
  status: KycDocumentStatus;

  @ApiPropertyOptional({
    example: 'Document is clear and valid.',
    description: 'Optional reviewer notes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class KycDocumentResponseDto {
  id: string;
  userId: string;
  documentType: KycDocumentType;
  status: KycDocumentStatus;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  rejectionReason?: string;
  reviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;

  /** Never includes encryptedData, nonce, or tag. */
}

export class KycStatusResponseDto {
  kycStatus: string;
  documents: KycDocumentResponseDto[];
  lastUpdated?: Date;
}
