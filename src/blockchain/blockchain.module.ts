import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainTransaction } from './entities/blockchain-transaction.entity';
import { WalletAddress } from './entities/wallet-address.entity';
import { StellarService } from './services/stellar.service';
import { EthereumService } from './services/ethereum.service';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { BulkheadService } from '../common/services/bulkhead.service';
import { CorrelationIdService } from '../common/services/correlation-id.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainTransaction, WalletAddress])],
  providers: [
    StellarService,
    EthereumService,
    CircuitBreakerService,
    BulkheadService,
    CorrelationIdService,
  ],
  exports: [StellarService, EthereumService, CircuitBreakerService, BulkheadService],
})
export class BlockchainModule {}
