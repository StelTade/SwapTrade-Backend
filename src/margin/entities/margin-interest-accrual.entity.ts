import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('margin_interest_accruals')
@Index(['positionId', 'accrualDate'])
export class MarginInterestAccrual {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  positionId: string;

  @Column()
  userId: number;

  @Column('decimal', { precision: 18, scale: 8 })
  borrowedAmount: number;

  @Column('decimal', { precision: 18, scale: 8 })
  interestAmount: number;

  @Column()
  dailyInterestRateBps: number;

  @Column('decimal', { precision: 18, scale: 8 })
  accruedTotalAfter: number;

  @Column({ type: 'date' })
  accrualDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
