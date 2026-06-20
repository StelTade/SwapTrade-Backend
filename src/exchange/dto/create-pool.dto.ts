import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePoolDto {
  @IsInt()
  tokenAId: number;

  @IsInt()
  tokenBId: number;

  @IsString()
  chainId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeBps?: number;
}
