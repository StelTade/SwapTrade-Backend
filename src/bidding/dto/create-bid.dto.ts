import { IsNumber, IsPositive, IsUUID, IsString } from 'class-validator';

export class CreateBidDto {
  @IsNumber()
  userId: number;

  @IsString()
  asset: string;

  @IsString()
  status: string;

  @IsUUID()
  assetId: string;

  @IsNumber()
  @IsPositive({ message: 'Bid amount must be greater than zero' })
  amount: number;

  @IsNumber()
  @IsPositive({ message: 'Bid price must be greater than zero' })
  price: number;
}
