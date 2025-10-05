import { IsBoolean } from 'class-validator';

export class UpdatePreferencesDto {
  @IsBoolean()
  orderFilled: boolean;

  @IsBoolean()
  priceAlerts: boolean;

  @IsBoolean()
  achievementUnlocked: boolean;
}