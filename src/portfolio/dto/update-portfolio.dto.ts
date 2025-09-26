import { IsNumber, IsString } from 'class-validator';

export class UpdatePortfolioDto {
  @IsNumber()
  userId: number;

  @IsString()
  asset: string;

  @IsNumber()
  balance: number;
}
