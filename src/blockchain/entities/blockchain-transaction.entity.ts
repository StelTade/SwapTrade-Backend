import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BlockchainNetwork {
  STELLAR = 'stellar',
  ETHEREUM = 'ethereum',
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  BRIDGE = 'bridge',
  SETTLEMENT = 'settlement',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('blockchain_transactions')
@Index(['userId'])
@Index(['txHash'])
@Index(['status'])
export class BlockchainTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'varchar' })
  network: BlockchainNetwork;

  @Column({ type: 'varchar' })
  type: TransactionType;

  @Column({ type: 'varchar' })
  status: TransactionStatus;

  @Column({ nullable: true })
  @Index()
  txHash: string;

  @Column()
  fromAddress: string;

  @Column()
  toAddress: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: string;

  @Column({ default: 'USDC' })
  asset: string;

  @Column({ nullable: true })
  memo: string;

  @Column({ default: 0 })
  confirmations: number;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
