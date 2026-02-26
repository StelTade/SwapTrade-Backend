
import { IsString, IsNumber, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsAssetType } from '../../common/validation';

export class GetUserBalancesDto {
  @ApiProperty({ example: 'BTC', description: 'Asset symbol' })
  @IsAssetType()
  asset: string;

  @ApiProperty({ example: 1.5, description: 'User balance for the asset' })
  @IsNumber()
  balance: number;
}

export class GetUserBalancesResponseDto {
  @ApiProperty({ type: [GetUserBalancesDto], description: 'Array of user balances' })
  @ArrayMinSize(0)
  data: GetUserBalancesDto[];

  @ApiProperty({ example: 2, description: 'Total number of assets' })
  @IsNumber()
  total: number;

  @ApiProperty({ example: 20, description: 'Number of entries returned per page' })
  @IsNumber()
  limit: number;

  @ApiProperty({ example: 0, description: 'Number of entries skipped' })
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
