import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TradeType } from '../../common/enums/trade-type.enum';
import { User } from '../../user/entities/user.entity';

@Entity()
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

  @Index()
  @Column()
  asset: string;

  @Column('decimal')
  amount: number;

  @Column('decimal')
  price: number;

  @Column({ type: 'varchar', default: 'BUY' })
  type: TradeType;

  @CreateDateColumn()
  createdAt: Date;
}
