import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import {
  BlockchainNetwork,
  BlockchainTransaction,
  TransactionStatus,
  TransactionType,
} from '../../../blockchain/entities/blockchain-transaction.entity';
import {
  BroadcastParams,
  BroadcastResult,
  ChainBroadcaster,
} from './chain-broadcaster.interface';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

interface EvmChainConfig {
  rpcUrl: string;
  usdcAddress: string;
  confirmations: number;
}

/**
 * Outbound EVM (Ethereum / BSC) transfers, gated by `WALLET_EVM_BROADCAST_ENABLED`.
 *
 * When enabled (and a platform key is configured) it performs a real ERC-20
 * `transfer` from the platform wallet. When disabled — the safe default for
 * dev/test — it records a simulated transaction with a synthetic hash so the
 * full withdrawal lifecycle can be exercised without moving real funds or
 * requiring a funded key.
 */
@Injectable()
export class EvmBroadcaster implements ChainBroadcaster {
  private readonly logger = new Logger(EvmBroadcaster.name);
  private readonly broadcastEnabled: boolean;
  private readonly platformPrivateKey?: string;
  private readonly chains: Partial<Record<BlockchainNetwork, EvmChainConfig>>;
  private readonly providers = new Map<BlockchainNetwork, ethers.JsonRpcProvider>();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(BlockchainTransaction)
    private readonly txRepo: Repository<BlockchainTransaction>,
  ) {
    this.broadcastEnabled = this.configService.get<boolean>(
      'WALLET_EVM_BROADCAST_ENABLED',
      false,
    );
    this.platformPrivateKey = this.configService.get<string>(
      'EVM_PLATFORM_PRIVATE_KEY',
    );

    this.chains = {
      [BlockchainNetwork.ETHEREUM]: {
        rpcUrl: this.configService.get<string>(
          'ETHEREUM_RPC_URL',
          'https://rpc.ankr.com/eth_sepolia',
        ),
        usdcAddress: this.configService.get<string>(
          'ETHEREUM_USDC_ADDRESS',
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        ),
        confirmations: this.configService.get<number>(
          'ETHEREUM_CONFIRMATIONS',
          12,
        ),
      },
      [BlockchainNetwork.BSC]: {
        rpcUrl: this.configService.get<string>(
          'BSC_RPC_URL',
          'https://bsc-testnet-rpc.publicnode.com',
        ),
        usdcAddress: this.configService.get<string>(
          'BSC_USDC_ADDRESS',
          '0x64544969ed7EBf5f083679233325356EbE738930',
        ),
        confirmations: this.configService.get<number>('BSC_CONFIRMATIONS', 15),
      },
    };
  }

  supports(network: BlockchainNetwork): boolean {
    return (
      network === BlockchainNetwork.ETHEREUM ||
      network === BlockchainNetwork.BSC
    );
  }

  isValidAddress(_network: BlockchainNetwork, address: string): boolean {
    return ethers.isAddress(address);
  }

  async send(
    network: BlockchainNetwork,
    params: BroadcastParams,
  ): Promise<BroadcastResult> {
    const asset = params.asset ?? 'USDC';

    if (this.broadcastEnabled && this.platformPrivateKey) {
      return this.sendReal(network, params, asset);
    }

    // Dev-safe simulation: no funds move, but the lifecycle is exercised.
    const txHash = ethers.hexlify(ethers.randomBytes(32));
    const record = await this.txRepo.save(
      this.txRepo.create({
        userId: params.userId,
        network,
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
        txHash,
        fromAddress: 'SIMULATED_PLATFORM_WALLET',
        toAddress: params.toAddress,
        amount: params.amount,
        asset,
        memo: params.memo,
        confirmations: 0,
        metadata: { simulated: true },
      }),
    );
    this.logger.warn(
      `EVM broadcast disabled — simulated ${network} withdrawal ${txHash} ` +
        `(${params.amount} ${asset} → ${params.toAddress})`,
    );
    return { txHash, blockchainTxId: record.id };
  }

  private async sendReal(
    network: BlockchainNetwork,
    params: BroadcastParams,
    asset: string,
  ): Promise<BroadcastResult> {
    const chain = this.chainConfig(network);
    const provider = this.providerFor(network);
    const signer = new ethers.Wallet(this.platformPrivateKey!, provider);
    const erc20 = new ethers.Contract(chain.usdcAddress, ERC20_ABI, signer);

    const decimals: number = await erc20.decimals();
    const value = ethers.parseUnits(params.amount, decimals);
    const tx = await erc20.transfer(params.toAddress, value);

    const record = await this.txRepo.save(
      this.txRepo.create({
        userId: params.userId,
        network,
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
        txHash: tx.hash,
        fromAddress: signer.address,
        toAddress: params.toAddress,
        amount: params.amount,
        asset,
        memo: params.memo,
        confirmations: 0,
      }),
    );
    this.logger.log(
      `Broadcast real ${network} withdrawal ${tx.hash} ` +
        `(${params.amount} ${asset} → ${params.toAddress})`,
    );
    return { txHash: tx.hash, blockchainTxId: record.id };
  }

  async getConfirmations(
    network: BlockchainNetwork,
    txHash: string,
  ): Promise<number> {
    if (!txHash) return 0;

    // Simulated sends are never mined; treat them as confirmed so the
    // lifecycle can complete in dev/test.
    if (!this.broadcastEnabled || !this.platformPrivateKey) {
      return this.chainConfig(network).confirmations;
    }

    try {
      const provider = this.providerFor(network);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) return 0;
      const current = await provider.getBlockNumber();
      return current - receipt.blockNumber + 1;
    } catch (err) {
      this.logger.error(
        `Failed to read confirmations for ${network} tx ${txHash}: ${
          (err as Error).message
        }`,
      );
      return 0;
    }
  }

  private chainConfig(network: BlockchainNetwork): EvmChainConfig {
    const chain = this.chains[network];
    if (!chain) {
      throw new Error(`No EVM chain config for network ${network}`);
    }
    return chain;
  }

  private providerFor(network: BlockchainNetwork): ethers.JsonRpcProvider {
    let provider = this.providers.get(network);
    if (!provider) {
      provider = new ethers.JsonRpcProvider(this.chainConfig(network).rpcUrl);
      this.providers.set(network, provider);
    }
    return provider;
  }
}
