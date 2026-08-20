import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';

export class VerifyDepositDto {
  @ApiProperty({ description: 'On-chain transaction hash of the deposit' })
  @IsString()
  @IsNotEmpty()
  txHash: string;

  @ApiProperty({ enum: BlockchainNetwork })
  @IsEnum(BlockchainNetwork)
  network: BlockchainNetwork;
}
