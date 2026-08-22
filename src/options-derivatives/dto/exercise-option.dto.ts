import { IsInt, IsPositive, IsNumber, IsOptional, Min } from 'class-validator';

export class ExerciseOptionDto {
  @IsInt()
  @IsPositive()
  contractId: number;

  @IsInt()
  @IsPositive()
  userId: number;

  /** Number of contracts to exercise. */
  @IsNumber()
  @Min(1)
  quantity: number;

  /** Current market price of underlying (used for settlement). */
  @IsNumber()
  @IsPositive()
  currentPrice: number;
}
