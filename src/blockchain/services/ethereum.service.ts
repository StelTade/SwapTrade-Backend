import { Injectable, Logger } from '@nestjs/common';
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

// Minimal ERC-20 ABI for transfer event decoding
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
];

@Injectable()
export class EthereumService {
  private readonly logger = new Logger(EthereumService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly usdcAddress: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(BlockchainTransaction)
    private readonly txRepo: Repository<BlockchainTransaction>,
    @InjectRepository(WalletAddress)
    private readonly walletRepo: Repository<WalletAddress>,
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
