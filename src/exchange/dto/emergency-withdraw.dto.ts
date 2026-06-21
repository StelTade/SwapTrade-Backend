import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class EmergencyWithdrawDto {
  @IsInt()
  userId: number;

  @IsNumber()
  @Min(0)
  lpAmount: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsInt()
  adminApprovedBy?: number;
}
