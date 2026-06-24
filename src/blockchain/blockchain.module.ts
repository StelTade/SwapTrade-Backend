import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainTransaction } from './entities/blockchain-transaction.entity';
import { WalletAddress } from './entities/wallet-address.entity';
import { StellarService } from './services/stellar.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainTransaction, WalletAddress])],
  providers: [StellarService],
  exports: [StellarService],
})
export class BlockchainModule {}
