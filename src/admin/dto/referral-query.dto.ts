import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum ReferralStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FLAGGED = 'flagged',
  REJECTED = 'rejected',
}

export class ReferralQueryDto {
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  suspect?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
