import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';

@Entity('user_balances')
@Unique(['userId', 'assetId'])
export class UserBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  assetId: string;

  @ManyToOne(() => VirtualAsset, { eager: true })
  @JoinColumn({ name: 'assetId' })
  asset: VirtualAsset;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  amount: number;

  // Portfolio tracking fields - NEW
  @Column({ type: 'int', default: 0 })
  totalTrades: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  cumulativePnL: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  totalTradeVolume: number;

  @Column({ type: 'timestamp', nullable: true })
  lastTradeDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}