import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReferralDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Referrer user ID' })
  @IsUUID()
  referrerId: string;

  @ApiPropertyOptional({
    example: 'ABC123XY',
    description: 'Referral code used',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;
}

export class ReferralCallbackDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Referee user ID (user who was referred)' })
  @IsUUID()
  refereeId: string;

  @ApiProperty({ example: 'ABC123XY', description: 'Referral code used' })
  @IsString()
  @MaxLength(20)
  referralCode: string;

  @ApiPropertyOptional({
    example: '192.168.1.1',
    description: 'Referee IP address',
  })
  @IsOptional()
  @IsString()
  refereeIP?: string;
}
