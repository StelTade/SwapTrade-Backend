import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UserHistoryFilterDto {
  @IsOptional()
  @IsString()
  eventType?: string; // e.g., 'buy', 'sell'

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
