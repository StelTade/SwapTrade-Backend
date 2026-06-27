import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from 'stellar-sdk';
import {
  BlockchainTransaction,
  BlockchainNetwork,
  TransactionType,
  TransactionStatus,
} from '../entities/blockchain-transaction.entity';
import { WalletAddress } from '../entities/wallet-address.entity';
import { BlockchainException } from '../../error/exceptions/blockchain.exception';
import { CircuitBreakerService, CircuitBreakerOptions } from '../../common/services/circuit-breaker.service';
import { BulkheadService, BulkheadConfig } from '../../common/services/bulkhead.service';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly usdcIssuer: string;
  private readonly platformKeypair: StellarSdk.Keypair;
  private readonly circuitBreakerName = 'stellar-horizon';
  private readonly bulkheadName = 'stellar-bulkhead';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(BlockchainTransaction)
    private readonly txRepo: Repository<BlockchainTransaction>,
    @InjectRepository(WalletAddress)
    private readonly walletRepo: Repository<WalletAddress>,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly bulkheadService: BulkheadService,
  ) {
    const horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );
    this.networkPassphrase = this.configService.get<string>(
      'STELLAR_NETWORK_PASSPHRASE',
      StellarSdk.Networks.TESTNET,
    );
    this.usdcIssuer = this.configService.get<string>('STELLAR_USDC_ISSUER', '');
    this.server = new StellarSdk.Horizon.Server(horizonUrl);

    const platformSecret = this.configService.get<string>(
      'STELLAR_PLATFORM_SECRET',
      '',
    );
    this.platformKeypair = platformSecret
      ? StellarSdk.Keypair.fromSecret(platformSecret)
      : StellarSdk.Keypair.random();
  }

  onModuleInit() {
    // Register circuit breaker for Stellar Horizon API calls
    const circuitBreakerOptions: CircuitBreakerOptions = {
      name: this.circuitBreakerName,
      timeout: 30000,
      errorThresholdPercentage: 50,
      volumeThreshold: 10,
      rollingCountTimeout: 60000,
      rollingCountBuckets: 10,
      fallback: async (error: Error, ...args: any[]) => {
        this.logger.error(`Stellar Horizon circuit breaker fallback triggered: ${error.message}`);
        throw BlockchainException.networkError({ error: 'Stellar service unavailable', details: error.message });
      },
    };

    this.circuitBreakerService.register(
      async () => ({ success: true }),
      circuitBreakerOptions,
    );

    // Create bulkhead for Stellar operations
    const bulkheadConfig: BulkheadConfig = {
      name: this.bulkheadName,
      maxConcurrent: 5,
      maxQueueSize: 20,
      timeout: 60000,
    };

    this.bulkheadService.createBulkhead(bulkheadConfig);
    this.logger.log('Stellar service initialized with circuit breaker and bulkhead');
  }

  async getOrCreateWallet(userId: string): Promise<WalletAddress> {
    const existing = await this.walletRepo.findOne({
      where: { userId, network: BlockchainNetwork.STELLAR, isActive: true },
    });
    if (existing) return existing;

    const keypair = StellarSdk.Keypair.random();
    const wallet = this.walletRepo.create({
      userId,
      network: BlockchainNetwork.STELLAR,
      address: keypair.publicKey(),
      encryptedPrivateKey: keypair.secret(), // TODO: encrypt with KMS in production
    });
    return this.walletRepo.save(wallet);
  }

  /** Send USDC from the platform wallet to a recipient Stellar address */
  async withdraw(
    userId: string,
    toAddress: string,
    amount: string,
    memo?: string,
  ): Promise<BlockchainTransaction> {
    return this.bulkheadService.execute(
      this.bulkheadName,
      async () => {
        return this.circuitBreakerService.execute(
          this.circuitBreakerName,
          async () => this.withdrawInternal(userId, toAddress, amount, memo),
        );
      },
      'withdraw',
    );
  }

  private async withdrawInternal(
    userId: string,
    toAddress: string,
    amount: string,
    memo?: string,
  ): Promise<BlockchainTransaction> {
    const wallet = await this.walletRepo.findOne({
      where: { userId, network: BlockchainNetwork.STELLAR, isActive: true },
    });
    if (!wallet)
      throw BlockchainException.transactionFailed({
        reason: 'No Stellar wallet for user',
      });

    const txRecord = this.txRepo.create({
      userId,
      network: BlockchainNetwork.STELLAR,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      fromAddress: this.platformKeypair.publicKey(),
      toAddress,
      amount,
      asset: 'USDC',
      memo,
    });
    await this.txRepo.save(txRecord);

    try {
      const account = await this.server.loadAccount(
        this.platformKeypair.publicKey(),
      );
      const usdcAsset = new StellarSdk.Asset('USDC', this.usdcIssuer);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: toAddress,
            asset: usdcAsset,
            amount,
          }),
        )
        .addMemo(memo ? StellarSdk.Memo.text(memo) : StellarSdk.Memo.none())
        .setTimeout(30)
        .build();

      tx.sign(this.platformKeypair);
      const result = await this.server.submitTransaction(tx);

      txRecord.txHash = result.hash;
      txRecord.status = TransactionStatus.CONFIRMED;
      txRecord.confirmations = 1;
    } catch (err) {
      this.logger.error(`Stellar withdrawal failed for user ${userId}`, err);
      txRecord.status = TransactionStatus.FAILED;
      txRecord.errorMessage = err.message;
      await this.txRepo.save(txRecord);
      throw BlockchainException.transactionFailed({ error: err.message });
    }

    return this.txRepo.save(txRecord);
  }
}
