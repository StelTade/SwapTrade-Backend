import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';

export class DepositAddressDto {
  @ApiProperty({ enum: BlockchainNetwork })
  @IsEnum(BlockchainNetwork)
  network: BlockchainNetwork;
}
