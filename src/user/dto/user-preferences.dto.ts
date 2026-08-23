import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UserPreferencesResponseDto {
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  priceAlerts: boolean;
  tradeConfirmations: boolean;
  language: string;
  theme: string;
  [key: string]: unknown;
}

export class ToggleNotificationDto {
  @ApiProperty({
    example: 'emailNotifications',
    description: 'Name of the notification preference to toggle',
  })
  @IsString()
  @MaxLength(50)
  key: string;

  @ApiProperty({
    example: true,
    description: 'New value for the notification preference',
  })
  @IsBoolean()
  value: boolean;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Enable/disable email notifications',
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable/disable push notifications',
  })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable/disable marketing emails',
  })
  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable/disable price alerts',
  })
  @IsOptional()
  @IsBoolean()
  priceAlerts?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable/disable trade confirmation notifications',
  })
  @IsOptional()
  @IsBoolean()
  tradeConfirmations?: boolean;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Preferred language code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({
    example: 'dark',
    description: 'UI theme preference',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string;
}
