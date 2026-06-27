import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuspendUserDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'Reason for suspension' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'Duration in hours (omit for indefinite)',
  })
  @IsOptional()
  @IsNumber()
  durationHours?: number;
}

export class ActivateUserDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsNumber()
  userId: number;

  @ApiPropertyOptional({ description: 'Notes about reactivation' })
  @IsOptional()
  @IsString()
  notes?: string;
}
