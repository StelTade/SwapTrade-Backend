/**
 * Admin DTOs - 管理员接口数据传输对象
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { IsString, IsOptional, IsInt, IsEnum, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

// Waitlist 状态枚举
export enum WaitlistStatus {
  PENDING = 'pending',
  INVITED = 'invited',
  ACTIVE = 'active',
  BLACKLISTED = 'blacklisted',
}

// ========== Waitlist 相关 DTO ==========

export class GetWaitlistQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  status?: WaitlistStatus;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

export class UpdateWaitlistStatusDto {
  @IsEnum(WaitlistStatus)
  status: WaitlistStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ManualInviteDto {
  @IsOptional()
  @IsString()
  message?: string;
}

// ========== Referral 相关 DTO ==========

export class GetReferralsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  suspect?: boolean;

  @IsOptional()
  @IsString()
  sortBy?: string = 'points';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

export class AdjustReferralPointsDto {
  @IsInt()
  @Type(() => Number)
  pointsAdjustment: number;

  @IsString()
  reason: string;
}

// ========== 响应 DTO ==========

export class PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
