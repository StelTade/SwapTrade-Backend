import { IsNumber, IsString } from 'class-validator';

export class CreateBidDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  amount: number;

  @IsString()
  asset: string;

  @IsString()
  status: string;
}
