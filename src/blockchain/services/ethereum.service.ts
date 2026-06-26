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

@Injectable()
export class EthereumService implements OnModuleInit {
  private readonly logger = new Logger(EthereumService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly usdcAddress: string;
  private readonly circuitBreakerName = 'ethereum-rpc';
  private readonly bulkheadName = 'ethereum-bulkhead';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(BlockchainTransaction)
    private readonly txRepo: Repository<BlockchainTransaction>,
    @InjectRepository(WalletAddress)
    private readonly walletRepo: Repository<WalletAddress>,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly bulkheadService: BulkheadService,
  ) {
    const rpcUrl = this.configService.get<string>(
      'ETHEREUM_RPC_URL',
      'https://rpc.ankr.com/eth_sepolia',
    );
    this.usdcAddress = this.configService.get<string>(
      'ETHEREUM_USDC_ADDRESS',
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    );
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  onModuleInit() {
    // Register circuit breaker for Ethereum RPC calls
    const circuitBreakerOptions: CircuitBreakerOptions = {
      name: this.circuitBreakerName,
      timeout: 30000,
      errorThresholdPercentage: 50,
      volumeThreshold: 10,
      rollingCountTimeout: 60000,
      rollingCountBuckets: 10,
      fallback: async (error: Error, ...args: any[]) => {
        this.logger.error(`Ethereum RPC circuit breaker fallback triggered: ${error.message}`);
        throw BlockchainException.networkError({ error: 'Ethereum service unavailable', details: error.message });
      },
    };

    this.circuitBreakerService.register(
      async () => ({ success: true }),
      circuitBreakerOptions,
    );

    // Create bulkhead for Ethereum operations
    const bulkheadConfig: BulkheadConfig = {
      name: this.bulkheadName,
      maxConcurrent: 5,
      maxQueueSize: 20,
      timeout: 60000,
    };

    this.bulkheadService.createBulkhead(bulkheadConfig);
    this.logger.log('Ethereum service initialized with circuit breaker and bulkhead');
  }

  /** Validate an Ethereum address format */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /** Create or retrieve an Ethereum wallet for the given user */
  async getOrCreateWallet(userId: string): Promise<WalletAddress> {
    const existing = await this.walletRepo.findOne({
      where: { userId, network: BlockchainNetwork.ETHEREUM, isActive: true },
    });
    if (existing) return existing;

    const wallet = ethers.Wallet.createRandom();
    const record = this.walletRepo.create({
      userId,
      network: BlockchainNetwork.ETHEREUM,
      address: wallet.address,
      encryptedPrivateKey: wallet.privateKey, // TODO: encrypt with KMS in production
    });
    return this.walletRepo.save(record);
  }

  /** Verify an ERC-20 deposit transaction and record it */
  async verifyDeposit(
    userId: string,
    txHash: string,
  ): Promise<BlockchainTransaction> {
    return this.bulkheadService.execute(
      this.bulkheadName,
      async () => {
        return this.circuitBreakerService.execute(
          this.circuitBreakerName,
          async () => this.verifyDepositInternal(userId, txHash),
        );
      },
      'verifyDeposit',
    );
  }

  private async verifyDepositInternal(
    userId: string,
    txHash: string,
  ): Promise<BlockchainTransaction> {
    const existing = await this.txRepo.findOne({ where: { txHash } });
    if (existing) return existing;

    const wallet = await this.walletRepo.findOne({
      where: { userId, network: BlockchainNetwork.ETHEREUM, isActive: true },
    });
    if (!wallet) throw BlockchainException.transactionFailed({ reason: 'No Ethereum wallet found for user' });

    let txRecord: BlockchainTransaction;
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) throw BlockchainException.transactionFailed({ reason: 'Transaction not found', txHash });

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      // Decode Transfer event from USDC contract
      const iface = new ethers.Interface(ERC20_ABI);
      let transferAmount = '0';
      let fromAddress = '';

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== this.usdcAddress.toLowerCase()) continue;
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
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
        network: BlockchainNetwork.ETHEREUM,
        type: TransactionType.DEPOSIT,
        status: confirmations >= 2 ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        txHash,
        fromAddress,
        toAddress: wallet.address,
        amount: transferAmount,
        asset: 'USDC',
        confirmations,
      });
    } catch (err) {
      if (err instanceof BlockchainException) throw err;
      this.logger.error(`Failed to verify ETH deposit ${txHash}`, err);
      throw BlockchainException.networkError({ txHash, error: err.message });
    }

    return this.txRepo.save(txRecord);
  }

  async getTransactionHistory(userId: string): Promise<BlockchainTransaction[]> {
    return this.txRepo.find({
      where: { userId, network: BlockchainNetwork.ETHEREUM },
      order: { createdAt: 'DESC' },
    });
  }
}
