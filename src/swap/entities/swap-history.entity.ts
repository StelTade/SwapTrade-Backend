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

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

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

  /** Quoted price at submission time (amountOut / amountIn) */
  @Column({ type: 'decimal', precision: 36, scale: 18 })
  quotedRate: number;

  /** Actual execution rate — may differ due to slippage */
  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  executedRate: number | null;

  /** Maximum acceptable slippage as a fraction, e.g. 0.005 = 0.5% */
  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0.005 })
  slippageTolerance: number;

  /** Actual slippage experienced: (quotedRate - executedRate) / quotedRate */
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  actualSlippage: number | null;

  /** Price impact as fraction of pool liquidity: amountIn / poolLiquidity */
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  priceImpact: number | null;

  @Column({ type: 'enum', enum: SwapStatus, default: SwapStatus.PENDING })
  status: SwapStatus;

  @Column({ type: 'enum', enum: SwapType, default: SwapType.SINGLE })
  swapType: SwapType;

  /** Bull job ID for tracing */
  @Column({ nullable: true })
  jobId: string | null;

  /** Groups swaps submitted together */
  @Column({ nullable: true })
  batchId: string | null;

  /** For multi-leg: ordered array of intermediate assets */
  @Column({ type: 'jsonb', nullable: true })
  route: string[] | null;

  /** Retry attempt count for settlement */
  @Column({ default: 0 })
  retryCount: number;

  /** Error message on failure */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /** Human-readable failure reason */
  @Column({ nullable: true })
  failureReason: string | null;

  /** Timestamp when execution started */
  @Column({ type: 'timestamptz', nullable: true })
  executedAt: Date | null;

  /** Timestamp of final settlement confirmation */
  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}