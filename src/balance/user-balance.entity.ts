import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { VirtualAsset } from 'src/trading/entities/virtual-asset.entity';

@Entity('user_balances')
@Unique(['userId', 'assetId'])
export class UserBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  assetId: string;

  @ManyToOne(() => VirtualAsset, (asset) => asset.balances, { eager: true })
  @JoinColumn({ name: 'assetId' })
  asset: VirtualAsset;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
