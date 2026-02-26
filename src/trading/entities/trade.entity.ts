import { TradeType } from '../../common/enums/trade-type.enum';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum TradeStatus {
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

@Entity('trades')
@Index(['asset', 'timestamp'])
@Index(['buyerId', 'timestamp'])
@Index(['sellerId', 'timestamp'])
@Index(['userId'])
@Index(['asset'])
@Index(['createdAt'])
@Index(['userId', 'createdAt'])
@Index(['asset', 'createdAt'])
export class Trade {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Column({ type: 'uuid' })
  @Index()
  buyerId: string;

  @Column({ type: 'uuid' })
  @Index()
  sellerId: string;

  @Column({ type: 'varchar', length: 50 })
  asset: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  totalValue: number;

  @Column({ type: 'varchar', default: 'BUY' })
  type: TradeType;

  @Column({
    type: 'enum',
    enum: TradeStatus,
    default: TradeStatus.EXECUTED,
  })
  @Index()
  status: TradeStatus;

  @Column({ type: 'uuid', nullable: true })
  bidId: string;

  @Column({ type: 'uuid', nullable: true })
  askId: string;

  @Column()
  quantity: number;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
