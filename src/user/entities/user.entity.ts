import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  assertNoGovernanceKycRoleConflict,
  normalizeRoleValues,
} from '../../common/security/role-separation';
import { AccountStatus } from '../../auth/entities/auth.entity';

@Entity('users')
@Index(['id'])
@Index(['email'], { unique: true })
@Check(
  'CHK_user_governance_kyc_role_separation',
  `NOT ("roles" LIKE '%GOVERNANCE_OPERATOR%' AND ("roles" LIKE '%KYC_OPERATOR%' OR "roles" LIKE '%KYC_GOVERNANCE%'))`,
)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Reference to the Auth credential record (same email FK). */
  @Column({ nullable: true })
  @Index()
  authId?: string;

  @Column()
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  // ─── Roles ─────────────────────────────────────────────────────────
  @Column({ type: 'varchar', default: UserRole.USER })
  role: UserRole;

  @Column('simple-array', { default: UserRole.USER })
  roles: UserRole[];

  // ─── Status ─────────────────────────────────────────────────────────
  @Column({
    type: 'varchar',
    default: AccountStatus.INACTIVE,
  })
  status: AccountStatus;

  // ─── Trading Stats ──────────────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  totalTrades: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  cumulativePnL: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  totalTradeVolume: number;

  @Column({ default: false })
  isPremium: boolean;

  // ─── MFA (mirrored from Auth for quick reads, source of truth is Auth) ─
  @Column({ default: false })
  mfaEnabled: boolean;

  @Column({ nullable: true, select: false })
  mfaSecret?: string;

  @Column('simple-array', { nullable: true, select: false })
  mfaRecoveryCodes?: string[];

  // ─── Timestamps ─────────────────────────────────────────────────────
  @UpdateDateColumn()
  lastTradeDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ─── Lifecycle Hooks ────────────────────────────────────────────────
  @BeforeInsert()
  @BeforeUpdate()
  validateRoleSeparation(): void {
    const normalizedRoles = normalizeRoleValues(this.roles?.length ? this.roles : this.role);
    assertNoGovernanceKycRoleConflict(normalizedRoles);

    this.roles = normalizedRoles as UserRole[];
    this.role = (this.role ?? this.roles[0] ?? UserRole.USER) as UserRole;
  }
}
