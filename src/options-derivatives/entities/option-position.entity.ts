import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OptionContract } from './option-contract.entity';

@Entity('option_positions')
@Index(['userId', 'contractId'])
@Index(['contractId', 'isWriter'])
export class OptionPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column()
  @Index()
  contractId: number;

  @ManyToOne(() => OptionContract)
  @JoinColumn({ name: 'contractId' })
  contract: OptionContract;

  /** Whether this position is a writer (seller) or holder (buyer). */
  @Column({ default: false })
  isWriter: boolean;

  /** Number of contracts held/written. */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  quantity: number;

  /** Average premium paid (buyer) or received (writer). */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  averagePremium: number;

  /** Total premium paid/received for this position. */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalPremium: number;

  /** Realized PnL from exercises or expirations. */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  realizedPnl: number;

  /** Unrealized PnL (mark-to-market). */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  unrealizedPnl: number;

  /** Number of contracts already exercised or expired. */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  exercisedQuantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
