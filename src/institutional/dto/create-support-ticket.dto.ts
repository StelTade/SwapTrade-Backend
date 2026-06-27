import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

/**
 * DTO for creating a new institutional support ticket.
 */
export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description: string;

  @IsOptional()
  @IsEnum([
    'GENERAL',
    'TRADING',
    'TECHNICAL',
    'COMPLIANCE',
    'BILLING',
    'ONBOARDING',
  ])
  category?:
    | 'GENERAL'
    | 'TRADING'
    | 'TECHNICAL'
    | 'COMPLIANCE'
    | 'BILLING'
    | 'ONBOARDING';

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsInt()
  assignedToId?: number;
}
