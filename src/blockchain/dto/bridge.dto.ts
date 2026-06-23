import { IsString, IsNotEmpty, IsNumberString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BlockchainNetwork } from '../entities/blockchain-transaction.entity';

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
  sourceAddress: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destinationAddress: string;

  @ApiProperty({ example: '50.00' })
  @IsNumberString()
  amount: string;
}
