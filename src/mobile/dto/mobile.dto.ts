import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsObject,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform } from '../entities/mobile-device.entity';

// ─── Device Registration ────────────────────────────────────────────────────

export class RegisterDeviceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appVersion?: string;
}

// ─── Push Notification ──────────────────────────────────────────────────────

export class SendPushDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Deep link URL' })
  @IsOptional()
  @IsString()
  deepLink?: string;
}

// ─── App Version Check ──────────────────────────────────────────────────────

export class CheckVersionDto {
  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty({ example: '1.2.3' })
  @IsString()
  @IsNotEmpty()
  version: string;
}

export class CreateAppVersionDto {
  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  minimumVersion: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  updateMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  storeUrl?: string;
}

// ─── Offline Sync ───────────────────────────────────────────────────────────

export class SyncItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty()
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checksum?: string;
}

export class BatchSyncDto {
  @ApiProperty({ type: [SyncItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  items: SyncItemDto[];
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export class TrackEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventName: string;

  @ApiPropertyOptional({ enum: DevicePlatform })
  @IsOptional()
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  screenName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class BatchTrackDto {
  @ApiProperty({ type: [TrackEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events: TrackEventDto[];
}

// ─── Biometric Auth ─────────────────────────────────────────────────────────

export class BiometricChallengeDto {
  @ApiProperty({ description: 'Device ID for biometric binding' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

export class BiometricVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ description: 'Signed challenge bytes (base64)' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ description: 'Server-issued challenge' })
  @IsString()
  @IsNotEmpty()
  challenge: string;
}
