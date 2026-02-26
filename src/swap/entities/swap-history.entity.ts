import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SwapStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  ROLLED_BACK = 'rolled_back',
}

export enum SwapType {
  SINGLE = 'single',       // A → B
  MULTI_LEG = 'multi_leg', // A → B → C (routed)
  BATCH = 'batch',         // queued with other swaps
}

@Entity('swap_history')
@Index(['userId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['batchId'])
export class SwapHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  @Index()
  userId: number;

  @Column({ type: 'varchar', length: 20 })
  fromAsset: string;

  @Column({ type: 'varchar', length: 20 })
  toAsset: string;

  /** Amount the user submitted */
  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amountIn: number;

  /** Amount the user receives after execution */
  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  amountOut: number | null;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  quotedRate: number;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  executedRate: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  slippageTolerance: number;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  actualSlippage: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  priceImpact: number | null;

  @Column({
    type: 'simple-enum',
    enum: SwapStatus,
    default: SwapStatus.PENDING,
  })
  status: SwapStatus;

  @Column({
    type: 'simple-enum',
    enum: SwapType,
    default: SwapType.SINGLE,
  })
  swapType: SwapType;

  /**
   * For multi-leg swaps, store the route as JSON array of asset symbols.
   * e.g. ["USDT", "ETH", "BTC"]
   */
  @Column({ type: 'simple-json', nullable: true })
  route: string[] | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string | null;

  /** ID of the Bull job processing this swap */
  @Column({ type: 'varchar', nullable: true })
  @Index()
  jobId: string | null;

  /** ID of the batch if part of a batch swap */
  @Column({ type: 'uuid', nullable: true })
  batchId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  executedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  settledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
