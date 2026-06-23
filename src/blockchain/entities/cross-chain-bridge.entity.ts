import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';

export enum BridgeStatus {
  INITIATED = 'initiated',
  SOURCE_CONFIRMED = 'source_confirmed',
  BRIDGE_PROCESSING = 'bridge_processing',
  DESTINATION_PENDING = 'destination_pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('cross_chain_bridges')
@Index(['userId'])
@Index(['status'])
export class CrossChainBridge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'varchar' })
  sourceNetwork: BlockchainNetwork;

  @Column({ type: 'varchar' })
  destinationNetwork: BlockchainNetwork;

  @Column()
  sourceAddress: string;

  @Column()
  destinationAddress: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: string;

  @Column({ default: 'USDC' })
  asset: string;

  @Column({ type: 'varchar', default: BridgeStatus.INITIATED })
  status: BridgeStatus;

  @Column({ nullable: true })
  sourceTxHash: string;

  @Column({ nullable: true })
  destinationTxHash: string;

  /** Number of multi-sig approvals collected */
  @Column({ default: 0 })
  multisigApprovals: number;

  /** Minimum required approvals before bridge executes */
  @Column({ default: 2 })
  multisigThreshold: number;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
