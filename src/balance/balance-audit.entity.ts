import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('balance_audit')
@Index(['userId'])
@Index(['userId', 'timestamp'])
@Index(['userId', 'asset'])
export class BalanceAudit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: string;

  @Column()
  asset: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amountChanged: number;

  @Column('decimal', { precision: 18, scale: 8 })
  resultingBalance: number;

  @Column()
  reason: string;

  @CreateDateColumn()
  timestamp: Date;

  // Additional fields for audit trail
  @Column({ nullable: true })
  transactionId?: string;

  @Column({ nullable: true })
  relatedOrderId?: string;

  @Column({ nullable: true })
  previousBalance?: number;
}
