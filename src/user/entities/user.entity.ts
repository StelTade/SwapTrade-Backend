import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';

@Entity()
@Index(['id'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', default: 'USER' })
  role: UserRole;

  @Column({ type: 'int', default: 0 })
  totalTrades: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  cumulativePnL: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  totalTradeVolume: number;

  @UpdateDateColumn()
  lastTradeDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
