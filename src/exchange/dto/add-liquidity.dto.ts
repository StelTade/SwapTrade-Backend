import { IsInt, IsNumber, Min } from 'class-validator';

export class AddLiquidityDto {
  @IsInt()
  userId: number;

  @IsNumber()
  @Min(0)
  amountA: number;

  @IsNumber()
  @Min(0)
  amountB: number;
}
