import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { InsuranceFund } from './insurance-fund.entity';

@Entity('liquidation_events')
export class LiquidationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: number;

  @Column({ nullable: true })
  positionId: string;

  @Column('decimal', { precision: 18, scale: 8 })
  shortfallAmount: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  coveredAmount: number;

  @Column({ nullable: true })
  fundId: number;

  @Column({ default: false })
  cascadePrevented: boolean;

  @Column({ default: 'COMPLETED' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => InsuranceFund, { nullable: true })
  @JoinColumn({ name: 'fundId' })
  fund: InsuranceFund;

  @CreateDateColumn()
  createdAt: Date;
}
