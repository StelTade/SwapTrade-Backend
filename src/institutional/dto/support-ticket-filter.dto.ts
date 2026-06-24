import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';

/**
 * DTO for filtering institutional support tickets.
 */
export class SupportTicketFilterDto {
  @IsOptional()
  @IsEnum([
    'OPEN',
    'IN_PROGRESS',
    'WAITING_ON_CLIENT',
    'ESCALATED',
    'RESOLVED',
    'CLOSED',
  ])
  status?: string;

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;

  @IsOptional()
  @IsEnum([
    'GENERAL',
    'TRADING',
    'TECHNICAL',
    'COMPLIANCE',
    'BILLING',
    'ONBOARDING',
  ])
  category?: string;

  @IsOptional()
  @IsInt()
  assignedToId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
