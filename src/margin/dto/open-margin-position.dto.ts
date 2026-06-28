import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { PositionSide } from '../enums/position-side.enum';

export class OpenMarginPositionDto {
  @IsInt()
  userId: number;

  @IsInt()
  pairConfigId: number;

  @IsEnum(PositionSide)
  side: PositionSide;

  @IsNumber()
  @Min(0.00000001)
  collateral: number;

  @IsNumber()
  @Min(1)
  leverage: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  entryPrice?: number;
}
