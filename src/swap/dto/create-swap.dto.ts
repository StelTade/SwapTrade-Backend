/**
 * CreateSwapDto
 *
 * Data Transfer Object for creating a swap.
 */
import { IsNumber, IsPositive, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSwapDto {
  @ApiProperty({ description: 'The ID of the user performing the swap' })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ description: 'The ID of the asset to swap from' })
  @IsNumber()
  @IsNotEmpty()
  fromAssetId: number;

  @ApiProperty({ description: 'The ID of the asset to swap to' })
  @IsNumber()
  @IsNotEmpty()
  toAssetId: number;

  @ApiProperty({ description: 'The amount of the asset to swap' })
  @IsNumber()
  @IsPositive()
  amount: number;
}
