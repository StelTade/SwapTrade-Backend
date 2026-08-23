import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';

export class AddLinkedWalletDto {
  @ApiProperty({
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    description: 'Wallet address to link',
  })
  @IsNotEmpty()
  @IsString()
  address: string;

  @ApiPropertyOptional({
    enum: BlockchainNetwork,
    example: BlockchainNetwork.ETHEREUM,
    description: 'Blockchain network for this address',
  })
  @IsOptional()
  @IsEnum(BlockchainNetwork)
  chain?: BlockchainNetwork;

  @ApiPropertyOptional({
    example: 'My Ledger',
    description: 'Human-readable label for the wallet',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Set this wallet as the primary wallet',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class SetPrimaryWalletDto {
  @ApiProperty({
    description: 'ID of the wallet to set as primary',
  })
  @IsNotEmpty()
  @IsString()
  walletId: string;
}

export class LinkedWalletResponseDto {
  id: string;
  address: string;
  chain: BlockchainNetwork;
  label?: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
