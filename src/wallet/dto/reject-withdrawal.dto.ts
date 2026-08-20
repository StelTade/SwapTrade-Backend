import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectWithdrawalDto {
  @ApiProperty({ description: 'Approving admin TOTP code (2FA enforced)' })
  @IsString()
  @IsNotEmpty()
  twoFactorToken: string;

  @ApiProperty({ description: 'Reason the withdrawal was rejected' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
