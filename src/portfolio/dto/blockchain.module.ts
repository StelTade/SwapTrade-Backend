import { Module, Global } from '@nestjs/common';
import { Web3Service } from './web3.service';
import { WalletService } from './wallet.service';

@Global()
@Module({
  providers: [Web3Service, WalletService],
  exports: [Web3Service, WalletService],
})
export class BlockchainModule {}