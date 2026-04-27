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

@Entity()
@Index(['id'])
@Check(
  'CHK_user_governance_kyc_role_separation',
  `NOT ("roles" LIKE '%GOVERNANCE_OPERATOR%' AND ("roles" LIKE '%KYC_OPERATOR%' OR "roles" LIKE '%KYC_GOVERNANCE%'))`,
)
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', default: 'USER' })
  role: UserRole;

  @Column('simple-array', { default: UserRole.USER })
  roles: UserRole[];

  @Column({ type: 'int', default: 0 })
  totalTrades: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  cumulativePnL: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  totalTradeVolume: number;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ default: false })
  mfaEnabled: boolean;

  @Column({ nullable: true, select: false })
  mfaSecret: string;

  @Column('simple-array', { nullable: true, select: false })
  mfaRecoveryCodes: string[];

  @UpdateDateColumn()
  lastTradeDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validateRoleSeparation(): void {
    const normalizedRoles = normalizeRoleValues(this.roles?.length ? this.roles : this.role);
    assertNoGovernanceKycRoleConflict(normalizedRoles);

    this.roles = normalizedRoles as UserRole[];
    this.role = (this.role ?? this.roles[0] ?? UserRole.USER) as UserRole;
  }
}
