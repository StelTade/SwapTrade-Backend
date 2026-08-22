import { IsInt, IsPositive, IsNumber, Min } from 'class-validator';

export class BuyOptionDto {
  @IsInt()
  @IsPositive()
  contractId: number;

  @IsInt()
  @IsPositive()
  userId: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}
