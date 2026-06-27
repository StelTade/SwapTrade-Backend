import { IsString, IsOptional, IsPhoneNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TwoFADto {
  @ApiProperty({ example: '123456', description: 'TOTP code or SMS OTP' })
  @IsString()
  code: string;
}

export class Enable2FADto {
  @ApiProperty({ example: 'totp', description: '2FA method: totp or sms' })
  @IsString()
  method: 'totp' | 'sms';

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number — required for SMS 2FA',
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;
}

export class Verify2FASetupDto {
  @ApiProperty({
    example: 'JBSWY3DPEHPK3PXP',
    description: 'TOTP base32 secret from setup step',
  })
  @IsString()
  secret: string;

  @ApiProperty({
    example: '123456',
    description: 'TOTP token to verify the setup',
  })
  @IsString()
  token: string;
}
