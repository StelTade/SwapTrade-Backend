import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';

export class InitiateWithdrawalDto {
  @ApiProperty({ enum: BlockchainNetwork })
  @IsEnum(BlockchainNetwork)
  network: BlockchainNetwork;

  @ApiProperty({
    example: 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    description: 'Destination address (Stellar public key or EVM address)',
  })
  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @ApiProperty({ example: 100.5, description: 'Amount to withdraw' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ default: 'USDC' })
  @IsString()
  @IsOptional()
  asset?: string;

  @ApiPropertyOptional({ description: 'Optional memo (Stellar)' })
  @IsString()
  @IsOptional()
  memo?: string;

  @ApiPropertyOptional({
    description: 'TOTP code — required when the amount meets the 2FA threshold',
  })
  @IsString()
  @IsOptional()
  twoFactorToken?: string;
}
