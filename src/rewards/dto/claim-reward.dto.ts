import { IsNumber, IsString, Min } from 'class-validator';
import { IsUserId } from '../../common/validation';

export class ClaimRewardDto {
  @IsUserId()
  userId: number;

  @IsNumber()
  @Min(0)
  xp: number;

  @IsString()
  @Min(1)
  badge: string;
}
