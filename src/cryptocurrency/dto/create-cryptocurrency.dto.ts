import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateCryptocurrencyDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  symbol: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  name: string;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  description?: string;
}
