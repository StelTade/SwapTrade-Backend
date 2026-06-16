import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('trades')
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: number;

  @Column()
  asset: string;

  @Column()
  type: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column('decimal', { precision: 18, scale: 8 })
  price: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalValue: number;

  @Column({ default: 'PENDING' })
  status: string;

  @Index()
  @CreateDateColumn()
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
