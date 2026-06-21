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
import { VirtualAsset } from './virtual-asset.entity';

@Entity('user_balances')
@Index(['userId', 'assetId'], { unique: true })
export class UserBalance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column()
  @Index()
  assetId: number;

  @Column('decimal', { precision: 15, scale: 8, default: 0 })
  balance: number;

  /**
   * Amount of `balance` currently reserved against open SELL orders
   * (limit, stop-loss, take-profit, trailing-stop). Only SELL-side
   * orders reserve funds here — see ORDERS_BUY_LOCKING limitation
   * note in orders.service.ts for why BUY orders don't.
   */
  @Column('decimal', { precision: 15, scale: 8, default: 0 })
  lockedBalance: number;

  @Column({ default: 0 })
  totalTrades: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  cumulativePnL: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalTradeVolume: number;

  @Column({ nullable: true })
  lastTradeDate: Date;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalInvested: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  averageBuyPrice: number;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'assetId' })
  asset: VirtualAsset;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get availableBalance(): number {
    return Number(this.balance) - Number(this.lockedBalance);
  }
}
