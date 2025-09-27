import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Reward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column('int')
  xp: number;

  @Column()
  badge: string;

  @CreateDateColumn()
  createdAt: Date;
}
