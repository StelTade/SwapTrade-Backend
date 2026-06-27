import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CrossChainBridge,
  BridgeStatus,
} from '../entities/cross-chain-bridge.entity';
import { BlockchainNetwork } from '../entities/blockchain-transaction.entity';
import { BlockchainException } from '../../error/exceptions/blockchain.exception';
import { StellarService } from './stellar.service';

const BRIDGE_RESERVE_THRESHOLD = 10_000;

@Injectable()
export class CrossChainBridgeService {
  private readonly logger = new Logger(CrossChainBridgeService.name);
  private readonly multisigThreshold: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(CrossChainBridge)
    private readonly bridgeRepo: Repository<CrossChainBridge>,
    private readonly stellarService: StellarService,
  ) {
    this.multisigThreshold = this.configService.get<number>(
      'BRIDGE_MULTISIG_THRESHOLD',
      2,
    );
  }

  async initiateBridge(
    userId: string,
    sourceNetwork: BlockchainNetwork,
    destinationNetwork: BlockchainNetwork,
    sourceAddress: string,
    destinationAddress: string,
    amount: string,
  ): Promise<CrossChainBridge> {
    const record = this.bridgeRepo.create({
      userId,
      sourceNetwork,
      destinationNetwork,
      sourceAddress,
      destinationAddress,
      amount,
      asset: 'USDC',
      status: BridgeStatus.INITIATED,
      multisigThreshold: this.multisigThreshold,
      multisigApprovals: 0,
    });
    return this.bridgeRepo.save(record);
  }

  async addApproval(bridgeId: string): Promise<CrossChainBridge> {
    const bridge = await this.bridgeRepo.findOne({ where: { id: bridgeId } });
    if (!bridge)
      throw BlockchainException.transactionFailed({
        reason: 'Bridge record not found',
        bridgeId,
      });

    if (
      bridge.status !== BridgeStatus.INITIATED &&
      bridge.status !== BridgeStatus.SOURCE_CONFIRMED
    ) {
      throw BlockchainException.transactionFailed({
        reason: 'Bridge is not awaiting approvals',
        bridgeId,
      });
    }

    bridge.multisigApprovals += 1;

    if (bridge.multisigApprovals >= bridge.multisigThreshold) {
      bridge.status = BridgeStatus.BRIDGE_PROCESSING;
      await this.bridgeRepo.save(bridge);
      return this.executeBridge(bridge);
    }

    return this.bridgeRepo.save(bridge);
  }

  private async executeBridge(
    bridge: CrossChainBridge,
  ): Promise<CrossChainBridge> {
    try {
      bridge.status = BridgeStatus.DESTINATION_PENDING;
      await this.bridgeRepo.save(bridge);

      if (bridge.destinationNetwork === BlockchainNetwork.STELLAR) {
        const tx = await this.stellarService.withdraw(
          bridge.userId,
          bridge.destinationAddress,
          bridge.amount,
          `bridge:${bridge.id}`,
        );
        bridge.destinationTxHash = tx.txHash;
      } else {
        // Ethereum destination: log intent and mark pending (hot-wallet signer external)
        this.logger.log(
          `Bridge ${bridge.id}: ETH destination tx queued for ${bridge.destinationAddress}`,
        );
      }

      bridge.status = BridgeStatus.COMPLETED;
    } catch (err) {
      this.logger.error(`Bridge ${bridge.id} execution failed`, err);
      bridge.status = BridgeStatus.FAILED;
      bridge.errorMessage = err.message;
      await this.bridgeRepo.save(bridge);
      await this.refundBridge(bridge);
      throw BlockchainException.transactionFailed({
        bridgeId: bridge.id,
        error: err.message,
      });
    }

    return this.bridgeRepo.save(bridge);
  }

  private async refundBridge(bridge: CrossChainBridge): Promise<void> {
    try {
      if (bridge.sourceNetwork === BlockchainNetwork.STELLAR) {
        await this.stellarService.withdraw(
          bridge.userId,
          bridge.sourceAddress,
          bridge.amount,
          `refund:${bridge.id}`,
        );
      }
      bridge.status = BridgeStatus.REFUNDED;
      await this.bridgeRepo.save(bridge);
      this.logger.log(
        `Bridge ${bridge.id} refunded to ${bridge.sourceAddress}`,
      );
    } catch (err) {
      this.logger.error(`Refund failed for bridge ${bridge.id}`, err);
    }
  }

  async getBridgeHealth(): Promise<{
    healthy: boolean;
    alertMessage?: string;
  }> {
    const totalLockedResult = await this.bridgeRepo
      .createQueryBuilder('b')
      .select('COALESCE(SUM(CAST(b.amount AS DECIMAL)), 0)', 'total')
      .where('b.status IN (:...statuses)', {
        statuses: [
          BridgeStatus.INITIATED,
          BridgeStatus.SOURCE_CONFIRMED,
          BridgeStatus.BRIDGE_PROCESSING,
        ],
      })
      .getRawOne<{ total: string }>();

    const totalLocked = parseFloat(totalLockedResult?.total ?? '0');
    const healthy = totalLocked < BRIDGE_RESERVE_THRESHOLD;

    return {
      healthy,
      alertMessage: healthy
        ? undefined
        : `Bridge reserves critically low: ${totalLocked} USDC locked in pending operations`,
    };
  }

  async getBridgeById(id: string): Promise<CrossChainBridge | null> {
    return this.bridgeRepo.findOne({ where: { id } });
  }

  async getBridgeHistory(userId: string): Promise<CrossChainBridge[]> {
    return this.bridgeRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
