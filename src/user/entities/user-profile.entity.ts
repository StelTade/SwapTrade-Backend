import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum KycVerificationStatus {
  NONE = 'none',
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Extended user profile — stores display-level metadata that lives outside
 * the core `users` table (which is auth/role-centric).
 *
 * One-to-one with User.id.
 */
@Entity('user_profiles')
@Index(['userId'], { unique: true })
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', nullable: true, length: 50 })
  displayName?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  contactEmail?: string;

  // ─── KYC ─────────────────────────────────────────────────────────────
  @Column({
    type: 'varchar',
    default: KycVerificationStatus.NONE,
  })
  kycStatus: KycVerificationStatus;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  kycRejectionReason?: string;

  // ─── Preferences (JSON blob) ──────────────────────────────────────────
  /**
   * Stores notification preferences and other user settings as a JSON
   * object. Example:
   * ```json
   * {
   *   "emailNotifications": true,
   *   "pushNotifications": true,
   *   "marketingEmails": false,
   *   "priceAlerts": true,
   *   "tradeConfirmations": true,
   *   "language": "en",
   *   "theme": "dark"
   * }
   * ```
   */
  @Column({ type: 'simple-json', default: '{}' })
  preferences: Record<string, unknown>;

  // ─── Timestamps ───────────────────────────────────────────────────────
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
