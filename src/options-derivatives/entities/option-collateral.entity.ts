import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OptionContract } from './option-contract.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { CollateralStatus } from '../enums/collateral-status.enum';

@Entity('option_collaterals')
@Index(['contractId', 'userId'])
@Index(['userId', 'status'])
export class OptionCollateral {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  contractId: number;

  @ManyToOne(() => OptionContract)
  @JoinColumn({ name: 'contractId' })
  contract: OptionContract;

  @Column()
  @Index()
  userId: number;

  @Column()
  collateralAssetId: number;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'collateralAssetId' })
  collateralAsset: VirtualAsset;

  /** Total amount of collateral locked. */
  @Column('decimal', { precision: 18, scale: 8 })
  lockedAmount: number;

  /** Amount still locked (decreases as contracts are exercised/expired). */
  @Column('decimal', { precision: 18, scale: 8 })
  remainingAmount: number;

  /** Number of contracts covered by this collateral. */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  coveredContracts: number;

  @Column({ type: 'varchar', default: CollateralStatus.LOCKED })
  status: CollateralStatus;

  @Column({ nullable: true })
  lockedAt: Date;

  @Column({ nullable: true })
  releasedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
