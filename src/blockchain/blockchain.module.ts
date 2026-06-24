import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainTransaction } from './entities/blockchain-transaction.entity';
import { WalletAddress } from './entities/wallet-address.entity';
import { CrossChainBridge } from './entities/cross-chain-bridge.entity';
import { StellarService } from './services/stellar.service';
import { EthereumService } from './services/ethereum.service';
import { CrossChainBridgeService } from './services/cross-chain-bridge.service';
import { BlockchainController } from './blockchain.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlockchainTransaction,
      WalletAddress,
      CrossChainBridge,
    ]),
  ],
  controllers: [BlockchainController],
  providers: [StellarService, EthereumService, CrossChainBridgeService],
  exports: [StellarService, EthereumService, CrossChainBridgeService],
})
export class BlockchainModule {}
