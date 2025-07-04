import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOfferDto {
  @IsNotEmpty()
  @IsNumber()
  offeredAssetId: number;

  @IsNotEmpty()
  @IsNumber()
  requestedAssetId: number;

  @IsNotEmpty()
  @IsNumber()
  recipientId: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  offeredAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  requestedAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
} 