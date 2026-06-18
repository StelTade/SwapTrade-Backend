import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { AnonymityLevel } from '../entities/privacy-profile.entity';

export class CreatePrivacyProfileDto {
  @IsString()
  publicKey: string;

  @IsEnum(AnonymityLevel)
  @IsOptional()
  anonymityLevel?: AnonymityLevel;

  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;

  @IsString()
  @IsOptional()
  encryptedPseudonym?: string;

  @IsObject()
  @IsOptional()
  privacySettings?: {
    hideOrderHistory?: boolean;
    hideBalance?: boolean;
    enableZKProofs?: boolean;
    autoDeleteOldOrders?: boolean;
    orderRetentionDays?: number;
  };
}

export class UpdatePrivacyProfileDto {
  @IsEnum(AnonymityLevel)
  @IsOptional()
  anonymityLevel?: AnonymityLevel;

  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;

  @IsObject()
  @IsOptional()
  privacySettings?: {
    hideOrderHistory?: boolean;
    hideBalance?: boolean;
    enableZKProofs?: boolean;
    autoDeleteOldOrders?: boolean;
    orderRetentionDays?: number;
  };

  @IsString()
  @IsOptional()
  encryptedPseudonym?: string;
}

export class PrivacyProfileResponseDto {
  id: string;
  pseudonymousId: string;
  anonymityLevel: AnonymityLevel;
  isAnonymous: boolean;
  anonymousOrderCount: number;
  anonymousTradeVolume: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PrivacySettingsDto {
  hideOrderHistory?: boolean;
  hideBalance?: boolean;
  enableZKProofs?: boolean;
  autoDeleteOldOrders?: boolean;
  orderRetentionDays?: number;
}
