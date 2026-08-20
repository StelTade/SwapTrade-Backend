import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from 'stellar-sdk';
import { StellarService } from '../../../blockchain/services/stellar.service';
import {
  BlockchainNetwork,
  BlockchainTransaction,
} from '../../../blockchain/entities/blockchain-transaction.entity';
import {
  BroadcastParams,
  BroadcastResult,
  ChainBroadcaster,
} from './chain-broadcaster.interface';

/**
 * Stellar outbound transfers. Delegates the actual send to the existing
 * {@link StellarService.withdraw}, which performs a real Horizon payment from
 * the platform keypair and records a {@link BlockchainTransaction}. Stellar
 * settlement is synchronous and final, so `getConfirmations` reflects the
 * confirmation count recorded at send time.
 */
@Injectable()
export class StellarBroadcaster implements ChainBroadcaster {
  constructor(
    private readonly stellarService: StellarService,
    @InjectRepository(BlockchainTransaction)
    private readonly txRepo: Repository<BlockchainTransaction>,
  ) {}

  supports(network: BlockchainNetwork): boolean {
    return network === BlockchainNetwork.STELLAR;
  }

  isValidAddress(_network: BlockchainNetwork, address: string): boolean {
    return StellarSdk.StrKey.isValidEd25519PublicKey(address);
  }

  async send(
    _network: BlockchainNetwork,
    params: BroadcastParams,
  ): Promise<BroadcastResult> {
    const tx = await this.stellarService.withdraw(
      params.userId,
      params.toAddress,
      params.amount,
      params.memo,
    );
    return { txHash: tx.txHash, blockchainTxId: tx.id };
  }

  async getConfirmations(
    _network: BlockchainNetwork,
    txHash: string,
  ): Promise<number> {
    if (!txHash) return 0;
    const tx = await this.txRepo.findOne({ where: { txHash } });
    return tx?.confirmations ?? 0;
  }
}
