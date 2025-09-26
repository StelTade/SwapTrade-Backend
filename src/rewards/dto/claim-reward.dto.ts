import { IsNumber, IsString } from 'class-validator';

export class ClaimRewardDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  xp: number;

  @IsString()
  badge: string;
}
