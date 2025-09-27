import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('balances')
export class Balance {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: string;

  @Column()
  asset: string;

  @Column('float')
  balance: number;
}
