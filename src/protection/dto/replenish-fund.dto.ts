import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ReplenishFundDto {
  @IsInt()
  fundId: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
