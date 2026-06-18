import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'StrongPassword123!', description: 'User password' })
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;

  @ApiPropertyOptional({ example: '123456', description: '2FA code (TOTP or SMS) — required if 2FA is enabled' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'Mozilla/5.0 ...', description: 'Device / user-agent info for session tracking' })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
