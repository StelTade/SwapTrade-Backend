import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'Crypto Trader',
    description: 'Public display name (max 50 characters)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'DeFi enthusiast and long-term hodler.',
    description: 'Short bio shown on the public profile (max 500 characters)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Contact email for profile inquiries',
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({
    example: {
      emailNotifications: true,
      pushNotifications: false,
      priceAlerts: true,
    },
    description: 'User notification preferences (merged with existing)',
  })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}
