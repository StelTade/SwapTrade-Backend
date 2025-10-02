/**
 * CreateSwapDto
 *
 * Data Transfer Object for creating a swap.
 * TODO: Define validation and fields.
 */
import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class CreateSwapDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  from: string; 

  @IsString()
  @IsNotEmpty()
  to: string; 

  @IsNumber()
  @IsPositive()
  amount: number;
}
