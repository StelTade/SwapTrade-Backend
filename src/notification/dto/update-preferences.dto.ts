import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  orderFilled?: boolean;

  @IsOptional()
  @IsBoolean()
  priceAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  achievementUnlocked?: boolean;
}