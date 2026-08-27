import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';
import { UserProfile } from './user-profile.entity';

/**
 * A user-linked wallet address. Each user may link multiple wallets across
 * different chains but exactly one must be marked as the primary wallet at
 * any time (enforced by service logic, not a DB constraint, because only one
 * row can have isPrimary = true and the uniqueness is scoped per user).
 */
@Entity('linked_wallets')
@Index(['userId', 'address'], { unique: true })
export class LinkedWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => UserProfile, (profile) => profile.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  profile: UserProfile;

  @Column({ type: 'varchar' })
  address: string;

  @Column({ type: 'varchar', default: BlockchainNetwork.ETHEREUM })
  chain: BlockchainNetwork;

  @Column({ type: 'varchar', nullable: true, length: 50 })
  label?: string;

  /** Exactly one wallet per user must be marked primary. */
  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ─── Timestamps ───────────────────────────────────────────────────────
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
