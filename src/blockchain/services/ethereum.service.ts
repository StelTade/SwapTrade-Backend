import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
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

// Minimal ERC-20 ABI for transfer event decoding
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
];

/** Per-chain settings for an EVM network (Ethereum, BSC, …). */
interface EvmChainSettings {
  provider: ethers.JsonRpcProvider;
  usdcAddress: string;
  confirmations: number;
}

/**
 * EVM connector for deposit detection and address management. Chain-parameterized
 * so a single service serves multiple EVM networks (Ethereum + BSC) via
 * per-chain config. Every public method accepts an optional `network` that
 * defaults to Ethereum, preserving the original single-chain call sites.
 */
@Injectable()
export class EthereumService implements OnModuleInit {
  private readonly logger = new Logger(EthereumService.name);
  private readonly chains = new Map<BlockchainNetwork, EvmChainSettings>();
  private readonly circuitBreakerName = 'evm-rpc';
  private readonly bulkheadName = 'evm-bulkhead';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(BlockchainTransaction)
    private readonly txRepo: Repository<BlockchainTransaction>,
    @InjectRepository(WalletAddress)
    private readonly walletRepo: Repository<WalletAddress>,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly bulkheadService: BulkheadService,
  ) {
    this.chains.set(BlockchainNetwork.ETHEREUM, {
      provider: new ethers.JsonRpcProvider(
        this.configService.get<string>(
          'ETHEREUM_RPC_URL',
          'https://rpc.ankr.com/eth_sepolia',
        ),
      ),
      usdcAddress: this.configService.get<string>(
        'ETHEREUM_USDC_ADDRESS',
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ),
      confirmations: this.configService.get<number>(
        'ETHEREUM_CONFIRMATIONS',
        12,
      ),
    });
    this.chains.set(BlockchainNetwork.BSC, {
      provider: new ethers.JsonRpcProvider(
        this.configService.get<string>(
          'BSC_RPC_URL',
          'https://bsc-testnet-rpc.publicnode.com',
        ),
      ),
      usdcAddress: this.configService.get<string>(
        'BSC_USDC_ADDRESS',
        '0x64544969ed7EBf5f083679233325356EbE738930',
      ),
      confirmations: this.configService.get<number>('BSC_CONFIRMATIONS', 15),
    });
  }

  onModuleInit() {
    // Register circuit breaker for EVM RPC calls
    const circuitBreakerOptions: CircuitBreakerOptions = {
      name: this.circuitBreakerName,
      timeout: 30000,
      errorThresholdPercentage: 50,
      volumeThreshold: 10,
      rollingCountTimeout: 60000,
      rollingCountBuckets: 10,
      fallback: async (error: Error, ...args: any[]) => {
        this.logger.error(`EVM RPC circuit breaker fallback triggered: ${error.message}`);
        throw BlockchainException.networkError({ error: 'EVM service unavailable', details: error.message });
      },
    };

    this.circuitBreakerService.register(
      async () => ({ success: true }),
      circuitBreakerOptions,
    );

    // Create bulkhead for EVM operations
    const bulkheadConfig: BulkheadConfig = {
      name: this.bulkheadName,
      maxConcurrent: 5,
      maxQueueSize: 20,
      timeout: 60000,
    };

    this.bulkheadService.createBulkhead(bulkheadConfig);
    this.logger.log('EVM service initialized with circuit breaker and bulkhead');
  }

  /** Validate an EVM address format (shared across Ethereum/BSC). */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /** Resolve per-chain settings, throwing for non-EVM networks. */
  private chainFor(network: BlockchainNetwork): EvmChainSettings {
    const chain = this.chains.get(network);
    if (!chain) {
      throw BlockchainException.transactionFailed({
        reason: `Unsupported EVM network: ${network}`,
      });
    }
    return chain;
  }

  /** Configured confirmation threshold for the given EVM network. */
  getConfirmationThreshold(network: BlockchainNetwork = BlockchainNetwork.ETHEREUM): number {
    return this.chainFor(network).confirmations;
  }

  /** Create or retrieve an EVM wallet for the given user + network. */
  async getOrCreateWallet(
    userId: string,
    network: BlockchainNetwork = BlockchainNetwork.ETHEREUM,
  ): Promise<WalletAddress> {
    this.chainFor(network); // validate network
    const existing = await this.walletRepo.findOne({
      where: { userId, network, isActive: true },
    });
    if (existing) return existing;

    const wallet = ethers.Wallet.createRandom();
    const record = this.walletRepo.create({
      userId,
      network,
      address: wallet.address,
      encryptedPrivateKey: wallet.privateKey, // TODO: encrypt with KMS in production
    });
    return this.walletRepo.save(record);
  }

  /** Verify an ERC-20 deposit transaction and record it. */
  async verifyDeposit(
    userId: string,
    txHash: string,
    network: BlockchainNetwork = BlockchainNetwork.ETHEREUM,
  ): Promise<BlockchainTransaction> {
    return this.bulkheadService.execute(
      this.bulkheadName,
      async () => {
        return this.circuitBreakerService.execute(
          this.circuitBreakerName,
          async () => this.verifyDepositInternal(userId, txHash, network),
        );
      },
      'verifyDeposit',
    );
  }

  private async verifyDepositInternal(
    userId: string,
    txHash: string,
    network: BlockchainNetwork,
  ): Promise<BlockchainTransaction> {
    const chain = this.chainFor(network);

    const existing = await this.txRepo.findOne({ where: { txHash } });
    if (existing) {
      // Already confirmed — nothing to do. Still pending — refresh its
      // confirmation count so the deposit reconciler can advance it.
      if (existing.status === TransactionStatus.CONFIRMED) return existing;
      return this.refreshConfirmations(existing, chain);
    }

    const wallet = await this.walletRepo.findOne({
      where: { userId, network, isActive: true },
    });
    if (!wallet)
      throw BlockchainException.transactionFailed({
        reason: `No ${network} wallet found for user`,
      });

    let txRecord: BlockchainTransaction;
    try {
      const receipt = await chain.provider.getTransactionReceipt(txHash);
      if (!receipt)
        throw BlockchainException.transactionFailed({
          reason: 'Transaction not found',
          txHash,
        });

      const currentBlock = await chain.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      // Decode Transfer event from USDC contract
      const iface = new ethers.Interface(ERC20_ABI);
      let transferAmount = '0';
      let fromAddress = '';

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== chain.usdcAddress.toLowerCase())
          continue;
        try {
          const parsed = iface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
          if (
            parsed?.name === 'Transfer' &&
            parsed.args.to.toLowerCase() === wallet.address.toLowerCase()
          ) {
            fromAddress = parsed.args.from;
            // USDC has 6 decimals
            transferAmount = ethers.formatUnits(parsed.args.value, 6);
            break;
          }
        } catch {
          // not a Transfer event
        }
      }

      if (!fromAddress) {
        throw BlockchainException.transactionFailed({
          reason: 'No USDC Transfer to user wallet found in transaction',
          txHash,
        });
      }

      txRecord = this.txRepo.create({
        userId,
        network,
        type: TransactionType.DEPOSIT,
        status:
          confirmations >= chain.confirmations
            ? TransactionStatus.CONFIRMED
            : TransactionStatus.PENDING,
        txHash,
        fromAddress,
        toAddress: wallet.address,
        amount: transferAmount,
        asset: 'USDC',
        confirmations,
      });
    } catch (err) {
      if (err instanceof BlockchainException) throw err;
      this.logger.error(`Failed to verify EVM deposit ${txHash}`, err);
      throw BlockchainException.networkError({ txHash, error: err.message });
    }

    return this.txRepo.save(txRecord);
  }

  /** Re-read the chain to refresh a pending deposit's confirmation count. */
  private async refreshConfirmations(
    tx: BlockchainTransaction,
    chain: EvmChainSettings,
  ): Promise<BlockchainTransaction> {
    try {
      const receipt = await chain.provider.getTransactionReceipt(tx.txHash);
      if (!receipt) return tx;
      const currentBlock = await chain.provider.getBlockNumber();
      tx.confirmations = currentBlock - receipt.blockNumber + 1;
      if (tx.confirmations >= chain.confirmations) {
        tx.status = TransactionStatus.CONFIRMED;
      }
      return this.txRepo.save(tx);
    } catch (err) {
      this.logger.error(
        `Failed to refresh confirmations for ${tx.txHash}: ${err.message}`,
      );
      return tx;
    }
  }

  async getTransactionHistory(
    userId: string,
    network: BlockchainNetwork = BlockchainNetwork.ETHEREUM,
  ): Promise<BlockchainTransaction[]> {
    return this.txRepo.find({
      where: { userId, network },
      order: { createdAt: 'DESC' },
    });
  }
}
