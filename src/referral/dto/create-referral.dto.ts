import { IsString, IsOptional, IsInt, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReferralDto {
  @ApiProperty({ example: 1, description: 'Referrer user ID' })
  @IsInt()
  referrerId: number;

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
  @ApiProperty({ example: 1, description: 'Referrer user ID' })
  @IsInt()
  referrerId: number;

  @ApiProperty({
    example: 2,
    description: 'Referee user ID (user who was referred)',
  })
  @IsInt()
  refereeId: number;

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
