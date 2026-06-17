import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountStatus } from '../../auth/entities/auth.entity';

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: AccountStatus,
    example: AccountStatus.SUSPENDED,
    description: 'New account status',
  })
  @IsEnum(AccountStatus)
  status: AccountStatus;

  @ApiPropertyOptional({ example: 'Violated terms of service', description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
