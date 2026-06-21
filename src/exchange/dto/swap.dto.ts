import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SwapDto {
  @IsInt()
  userId: number;

  @IsString()
  tokenIn: string;

  @IsNumber()
  @Min(0)
  amountIn: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmountOut?: number;
}
