import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  Max,
} from 'class-validator';
import { OptionType } from '../enums/option-type.enum';
import { ExerciseStyle } from '../enums/exercise-style.enum';

export class CreateOptionContractDto {
  @IsEnum(OptionType)
  optionType: OptionType;

  @IsOptional()
  @IsEnum(ExerciseStyle)
  exerciseStyle?: ExerciseStyle;

  @IsInt()
  @IsPositive()
  underlyingAssetId: number;

  @IsNumber()
  @IsPositive()
  strikePrice: number;

  @IsNumber()
  @Min(1)
  contractSize: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  underlyingPrice?: number;

  /** ISO date string for expiration. */
  expirationDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(5)
  impliedVolatility?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.25)
  riskFreeRate?: number;

  /** Number of contracts to mint. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalSupply?: number;

  /** Asset ID for collateral (for writers). */
  @IsOptional()
  @IsInt()
  collateralAssetId?: number;
}
