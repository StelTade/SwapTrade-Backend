import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Portfolio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  asset: string;

  @Column('decimal')
  balance: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
