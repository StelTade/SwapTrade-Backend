import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveWithdrawalDto {
  @ApiProperty({ description: 'Approving admin TOTP code (2FA enforced)' })
  @IsString()
  @IsNotEmpty()
  twoFactorToken: string;
}
