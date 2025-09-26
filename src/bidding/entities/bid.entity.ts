import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Bid {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column('decimal')
  amount: number;

  @Column()
  asset: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
