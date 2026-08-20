import { Injectable } from '@nestjs/common';
import { BlockchainNetwork } from '../../../blockchain/entities/blockchain-transaction.entity';
import { WalletException } from '../../exceptions/wallet.exception';
import { ChainBroadcaster } from './chain-broadcaster.interface';
import { StellarBroadcaster } from './stellar.broadcaster';
import { EvmBroadcaster } from './evm.broadcaster';

/**
 * Resolves the {@link ChainBroadcaster} responsible for a given network. The
 * EVM broadcaster serves both Ethereum and BSC; Stellar has its own.
 */
@Injectable()
export class BroadcasterRegistry {
  private readonly broadcasters: ChainBroadcaster[];

  constructor(
    stellarBroadcaster: StellarBroadcaster,
    evmBroadcaster: EvmBroadcaster,
  ) {
    this.broadcasters = [stellarBroadcaster, evmBroadcaster];
  }

  /** Returns the broadcaster for `network`, or throws if none supports it. */
  resolve(network: BlockchainNetwork): ChainBroadcaster {
    const broadcaster = this.broadcasters.find((b) => b.supports(network));
    if (!broadcaster) {
      throw WalletException.unsupportedNetwork(network);
    }
    return broadcaster;
  }

  /** Convenience: validate an address for the given network. */
  isValidAddress(network: BlockchainNetwork, address: string): boolean {
    return this.resolve(network).isValidAddress(network, address);
  }
}
