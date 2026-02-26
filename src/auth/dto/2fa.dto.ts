import { IsString, IsOptional, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TwoFADto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP', description: 'TOTP secret or SMS code' })
  @IsString()
  code: string;
}

export class Enable2FADto {
  @ApiProperty({ example: 'totp', description: '2FA method: totp or sms' })
  @IsString()
  method: 'totp' | 'sms';

  @ApiProperty({ example: '+1234567890', description: 'Phone number for SMS 2FA', required: false })
  @IsOptional()
  @IsPhoneNumber(null)
  phoneNumber?: string;
}
