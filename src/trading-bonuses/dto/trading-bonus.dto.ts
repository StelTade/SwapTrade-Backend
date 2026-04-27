import { IsString, IsOptional, IsInt, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class BonusQueryDto {
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class CalculateBonusDto {
  @IsInt()
  @Min(1)
  userId: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month: string;
}
