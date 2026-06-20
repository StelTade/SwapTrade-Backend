import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('token_holdings')
@Index(['userId', 'assetId'], { unique: true })
@Index(['userId'])
export class TokenHolding {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: string;

  @Column()
  @Index()
  assetId: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  balance: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  lockedBalance: number;

  @Column()
  lastUpdated: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
