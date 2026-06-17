import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  OneToMany,
} from 'typeorm';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  LOCKED = 'LOCKED',
}

@Entity('auth_credentials')
@Index(['email'], { unique: true })
export class Auth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Kept for backward-compatibility with legacy staffId-based code.
   * New code should use `email` as the primary identifier.
   */
  @Column({ unique: true, nullable: true })
  staffId?: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.INACTIVE,
  })
  status: AccountStatus;

  // ─── 2FA ────────────────────────────────────────────────────────────
  @Column({ nullable: true, select: false })
  totpSecret?: string;

  @Column({ default: false })
  is2FAEnabled: boolean;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true, select: false })
  smsCode?: string;

  @Column({ nullable: true, type: 'timestamp' })
  smsCodeExpiry?: Date;

  // ─── Account Lockout / Login Attempt Tracking ────────────────────────
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ nullable: true, type: 'timestamp' })
  lockedUntil?: Date;

  @Column({ nullable: true, type: 'timestamp' })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  lastLoginIp?: string;

  // ─── Activation Token ────────────────────────────────────────────────
  @Column({ nullable: true, select: false })
  activationToken?: string;

  @Column({ nullable: true, type: 'timestamp' })
  activationTokenExpiry?: Date;

  // ─── Password Reset ──────────────────────────────────────────────────
  @Column({ nullable: true, select: false })
  passwordResetToken?: string;

  @Column({ nullable: true, type: 'timestamp' })
  passwordResetExpiry?: Date;

  // ─── Refresh Tokens ──────────────────────────────────────────────────
  /**
   * Stores hashed refresh token families.
   * Column is excluded from default selects for security.
   */
  @Column({ type: 'simple-array', nullable: true, select: false })
  refreshTokenHashes?: string[];

  // ─── Correlation / Audit ─────────────────────────────────────────────
  @Column({ nullable: true })
  correlationId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
