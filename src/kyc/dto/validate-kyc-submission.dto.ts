import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsDateString,
  Length,
  Matches,
  IsEnum,
} from 'class-validator';

export enum DocumentType {
  PASSPORT = 'passport',
  NATIONAL_ID = 'national_id',
  DRIVERS_LICENSE = 'drivers_license',
}

export class ValidateKycSubmissionDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  fullName: string;

  @IsEmail()
  email: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  country: string;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty()
  @Length(4, 30)
  @Matches(/^[A-Z0-9-]+$/i, {
    message:
      'documentNumber must contain only alphanumeric characters and hyphens',
  })
  documentNumber: string;
}
