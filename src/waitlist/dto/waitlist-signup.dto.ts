import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WaitlistSignupDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address for waitlist registration' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'John Doe', description: 'Optional name of the user' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'REF123XYZ', description: 'Referral code if referred by another user' })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
