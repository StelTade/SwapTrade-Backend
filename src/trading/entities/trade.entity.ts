import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { TradeType } from '../../common/enums/trade-type.enum';

@Entity()
export class Trade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  asset: string;

  @Column('decimal')
  amount: number;

  @Column('decimal')
  price: number;

  @Column({ type: 'enum', enum: TradeType })
  type: TradeType;

  @CreateDateColumn()
  createdAt: Date;
}
