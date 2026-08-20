import { BlockchainNetwork } from '../../../blockchain/entities/blockchain-transaction.entity';

/** Parameters for broadcasting an outbound transfer. `amount` is a decimal string. */
export interface BroadcastParams {
  userId: string;
  toAddress: string;
  amount: string;
  asset?: string;
  memo?: string;
}

/** Result of a broadcast: the on-chain tx hash and the linked ledger tx row id. */
export interface BroadcastResult {
  txHash: string;
  blockchainTxId?: string;
}

/**
 * Chain-agnostic outbound transfer port. One implementation may serve several
 * networks (the EVM broadcaster handles both Ethereum and BSC), so every method
 * takes the target `network` explicitly rather than binding it per instance.
 */
export interface ChainBroadcaster {
  /** Whether this broadcaster handles the given network. */
  supports(network: BlockchainNetwork): boolean;

  /** Validate a destination address for the network's format. */
  isValidAddress(network: BlockchainNetwork, address: string): boolean;

  /** Broadcast the transfer. Returns as soon as the tx is submitted. */
  send(
    network: BlockchainNetwork,
    params: BroadcastParams,
  ): Promise<BroadcastResult>;

  /** Current confirmation count for a previously-sent tx (0 if unmined). */
  getConfirmations(
    network: BlockchainNetwork,
    txHash: string,
  ): Promise<number>;
}
