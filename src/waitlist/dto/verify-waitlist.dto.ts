import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyWaitlistDto {
  @ApiProperty({ example: 'abc123def456', description: 'Verification token' })
  @IsString()
  @Length(32, 64)
  token: string;
}
