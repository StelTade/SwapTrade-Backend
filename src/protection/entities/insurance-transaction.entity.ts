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
import { InsuranceTxType } from '../enums/insurance-tx-type.enum';

@Entity('insurance_transactions')
export class InsuranceTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  fundId: number;

  @Column({ type: 'varchar' })
  type: InsuranceTxType;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column('decimal', { precision: 18, scale: 8 })
  balanceBefore: number;

  @Column('decimal', { precision: 18, scale: 8 })
  balanceAfter: number;

  @Column({ nullable: true })
  @Index()
  referenceId: string;

  @Column({ nullable: true })
  @Index()
  userId: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown>;

  @ManyToOne(() => InsuranceFund)
  @JoinColumn({ name: 'fundId' })
  fund: InsuranceFund;

  @CreateDateColumn()
  createdAt: Date;
}
