import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';

@Entity()
export class TradeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  asset: string;

  @Column('decimal')
  quantity: number;

  @Column('decimal')
  price: number;

  @Column()
  side: 'BUY' | 'SELL';

  @CreateDateColumn()
  date: Date;
}
