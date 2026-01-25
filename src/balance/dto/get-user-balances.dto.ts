import { IsString, IsNumber, ArrayMinSize } from 'class-validator';
import { IsAssetType } from '../../common/validation';

export class GetUserBalancesDto {
  @IsAssetType()
  asset: string;

  @IsNumber()
  balance: number;
}

export class GetUserBalancesResponseDto {
  @ArrayMinSize(0)
  data: GetUserBalancesDto[];

  @IsNumber()
  total: number;

  @IsNumber()
  limit: number;

  @IsNumber()
  offset: number;

  constructor(
    data: GetUserBalancesDto[],
    total: number,
    limit: number,
    offset: number,
  ) {
    this.data = data;
    this.total = total;
    this.limit = limit;
    this.offset = offset;
  }
}
