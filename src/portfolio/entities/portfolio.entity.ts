import { Transaction } from '../../transactions/entities/transaction.entity';
import { User } from '../../user/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';

@Entity()
export class Portfolio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => User, (user) => user.portfolios)
  user: User;

  @OneToMany(() => Transaction, (tx) => tx.portfolio)
  transactions: Transaction[];
}
