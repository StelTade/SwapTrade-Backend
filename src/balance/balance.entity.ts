import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('Balance')
@Index(['userId'])
@Index(['asset'])
@Index(['userId', 'asset'])
export class Balance {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column()
  asset: string;

  @Column('float')
  balance: number;

  @Column(`float`)
  available: number;
}
