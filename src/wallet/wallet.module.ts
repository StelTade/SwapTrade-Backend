import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuthModule } from '../auth/auth.module';
import { BlockchainTransaction } from '../blockchain/entities/blockchain-transaction.entity';
import { Auth } from '../auth/entities/auth.entity';
import { AdminGuard } from '../common/guards/admin.guard';

import { WalletLedger } from './entities/wallet-ledger.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { WithdrawalRequest } from './entities/withdrawal-request.entity';
import { FiatPaymentIntent } from './entities/fiat-payment-intent.entity';

import { WalletController } from './wallet.controller';
import { WalletAdminController } from './wallet-admin.controller';

import { WalletLedgerService } from './services/wallet-ledger.service';
import { WalletRateLimitService } from './services/wallet-rate-limit.service';
import { DepositService } from './services/deposit.service';
import { WithdrawalService } from './services/withdrawal.service';
import { WithdrawalProcessorService } from './services/withdrawal-processor.service';
import { FiatPaymentService } from './services/fiat-payment.service';
import { StellarBroadcaster } from './services/broadcasters/stellar.broadcaster';
import { EvmBroadcaster } from './services/broadcasters/evm.broadcaster';
import { BroadcasterRegistry } from './services/broadcasters/broadcaster.registry';
import { StubPaymentProvider } from './providers/stub-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';

/**
 * Wallet & Payments module — the real-funds side of the platform: a
 * reservation-aware ledger, on-chain deposit crediting, a queued withdrawal
 * lifecycle with admin approval + 2FA, and provider-agnostic fiat rails.
 *
 * `BlockchainTransaction` is registered here (in addition to being owned by
 * {@link BlockchainModule}) because `forFeature` repository providers are
 * module-scoped: the broadcasters and {@link DepositService} inject that repo
 * directly. `Auth` is registered here for the same reason — {@link
 * WithdrawalService} reads it to enforce the high-value 2FA gate. The chain
 * connectors and {@link MFAService} come in as exported providers via the
 * imported modules.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletLedger,
      LedgerEntry,
      WithdrawalRequest,
      FiatPaymentIntent,
      Auth,
      BlockchainTransaction,
    ]),
    BlockchainModule,
    AuthModule,
  ],
  controllers: [WalletController, WalletAdminController],
  providers: [
    WalletLedgerService,
    WalletRateLimitService,
    DepositService,
    WithdrawalService,
    WithdrawalProcessorService,
    FiatPaymentService,
    StellarBroadcaster,
    EvmBroadcaster,
    BroadcasterRegistry,
    { provide: PAYMENT_PROVIDER, useClass: StubPaymentProvider },
    AdminGuard,
  ],
  exports: [WalletLedgerService],
})
export class WalletModule {}
