import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { VirtualAsset } from '../../trading/entities/virtual-asset.entity';

@Entity('Balance')
@Unique(['userId', 'assetId'])
export class UserBalance {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Index()
  @Column()
  assetId: number;

  @Column('decimal', { precision: 15, scale: 8, default: 0 })
  balance: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'assetId' })
  asset: VirtualAsset;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  total: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  reserved: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
