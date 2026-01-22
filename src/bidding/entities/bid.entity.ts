import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity()
@Index(['userId'])
@Index(['asset'])
@Index(['status'])
@Index(['createdAt'])
@Index(['userId', 'status'])
@Index(['asset', 'status'])
@Index(['status', 'createdAt'])
export class Bid {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Index()
  @Column('decimal')
  amount: number;

  @Index()
  @Column()
  asset: string;

  @Index()
  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
