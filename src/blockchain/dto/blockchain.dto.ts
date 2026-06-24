import {
  IsString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlockchainNetwork } from '../entities/blockchain-transaction.entity';

export class DepositAddressDto {
  @ApiProperty({ enum: BlockchainNetwork })
  @IsEnum(BlockchainNetwork)
  network: BlockchainNetwork;
}

export class WithdrawDto {
  @ApiProperty({ enum: BlockchainNetwork })
  @IsEnum(BlockchainNetwork)
  network: BlockchainNetwork;

  @ApiProperty({ example: 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' })
  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @ApiProperty({ example: '100.00' })
  @IsNumberString()
  amount: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  memo?: string;
}

export class BridgeTransferDto {
  @ApiProperty({ enum: BlockchainNetwork })
  @IsEnum(BlockchainNetwork)
  sourceNetwork: BlockchainNetwork;

  @ApiProperty({ enum: BlockchainNetwork })
  @IsEnum(BlockchainNetwork)
  destinationNetwork: BlockchainNetwork;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destinationAddress: string;

  @ApiProperty({ example: '50.00' })
  @IsNumberString()
  amount: string;
}

export class VerifyDepositDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  txHash: string;

  @ApiProperty({ enum: BlockchainNetwork })
  @IsEnum(BlockchainNetwork)
  network: BlockchainNetwork;
}
