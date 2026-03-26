import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupWaitlistDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'User name (optional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'ABC123XY',
    description: 'Referral code if referred by someone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;
}
