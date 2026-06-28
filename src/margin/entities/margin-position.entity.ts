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
import { PositionSide } from '../enums/position-side.enum';
import { PositionStatus } from '../enums/position-status.enum';
import { MarginPairConfig } from './margin-pair-config.entity';

@Entity('margin_positions')
@Index(['userId', 'status'])
@Index(['pairConfigId', 'status'])
export class MarginPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: number;

  @Column()
  pairConfigId: number;

  @Column({ type: 'varchar' })
  side: PositionSide;

  /** Position size in base asset units. */
  @Column('decimal', { precision: 18, scale: 8 })
  size: number;

  @Column('decimal', { precision: 18, scale: 8 })
  entryPrice: number;

  @Column('decimal', { precision: 8, scale: 2 })
  leverage: number;

  /** Collateral locked in quote asset. */
  @Column('decimal', { precision: 18, scale: 8 })
  collateral: number;

  /** Amount borrowed in quote asset. */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  borrowedAmount: number;

  @Column('decimal', { precision: 18, scale: 8 })
  liquidationPrice: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  unrealizedPnl: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  accruedInterest: number;

  @Column({ type: 'varchar', default: PositionStatus.OPEN })
  status: PositionStatus;

  @Column({ nullable: true })
  marginCallNotifiedAt: Date;

  @Column({ nullable: true })
  lastInterestAccrualAt: Date;

  @CreateDateColumn()
  openedAt: Date;

  @Column({ nullable: true })
  closedAt: Date;

  @Column({ nullable: true })
  liquidatedAt: Date;

  @ManyToOne(() => MarginPairConfig)
  @JoinColumn({ name: 'pairConfigId' })
  pairConfig: MarginPairConfig;

  @UpdateDateColumn()
  updatedAt: Date;
}
