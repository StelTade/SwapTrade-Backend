import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WaitlistVerifyDto {
  @ApiProperty({ example: 'abc123def456...', description: 'Verification token received via email' })
  @IsString()
  token: string;
}
