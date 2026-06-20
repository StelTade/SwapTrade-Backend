import { IsInt, IsNumber, Min } from 'class-validator';

export class RemoveLiquidityDto {
  @IsInt()
  userId: number;

  @IsNumber()
  @Min(0)
  lpAmount: number;
}
