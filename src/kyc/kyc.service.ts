import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  GOVERNANCE_ROLE_VALUES,
  KYC_ROLE_VALUES,
  RoleSeparationViolation,
  assertNoGovernanceKycRoleConflict,
  hasAnyRole,
  normalizeRoleValues,
} from '../common/security/role-separation';
import { KycStateMachineService } from './kyc-state-machine.service';
import { KycRole } from './enum/kyc-role.enum';
import { KycRecord } from './entities/kyc-records.entity';
import { KycStatus } from './enum/kyc-status.enum';

export interface AuthenticatedOperator {
  id: number;
  roles: string[];
}

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycRecord)
    private readonly kycRepo: Repository<KycRecord>,
    private readonly dataSource: DataSource,
    private readonly stateMachine: KycStateMachineService,
  ) {}

  // ─── Operator-controlled transitions ──────────────────────────────────────

  async updateStatus(
    targetUserId: number,
    nextStatus: KycStatus,
    operator: AuthenticatedOperator,
    notes?: string,
  ): Promise<KycRecord> {
    this.enforceOperatorRole(operator);
    this.preventSelfAssignment(operator.id, targetUserId);

    return this.dataSource.transaction(async (manager) => {
      const record = await this.findRecordForMutation(manager, targetUserId);

      if (!record) {
        throw new NotFoundException(
          `KYC record not found for user ${targetUserId}.`,
        );
      }

      // Enforce FSM — throws ForbiddenException for illegal transitions
      this.stateMachine.validateTransition(record.status, nextStatus);

      record.status = nextStatus;
      record.reviewedBy = String(operator.id);
      record.notes = notes ?? record.notes;

      return manager.save(KycRecord, record);
    });
  }

  // ─── Governance override (terminal state mutation) ─────────────────────────

  async governanceOverride(
    targetUserId: number,
    nextStatus: KycStatus,
    governance: AuthenticatedOperator,
    notes: string,
  ): Promise<KycRecord> {
    this.enforceKycGovernanceRole(governance);

    return this.dataSource.transaction(async (manager) => {
      const record = await this.findRecordForMutation(manager, targetUserId);

      if (!record) {
        throw new NotFoundException(
          `KYC record not found for user ${targetUserId}.`,
        );
      }

      // Governance bypasses FSM guard — but we still require notes
      record.status = nextStatus;
      record.reviewedBy = String(governance.id);
      record.notes = notes;

      return manager.save(KycRecord, record);
    });
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async getRecord(
    userId: number,
    requester: AuthenticatedOperator,
  ): Promise<KycRecord> {
    const requesterRoles = this.enforceKycEndpointAccess(requester);
    const isSelfRead = requester.id === userId;
    const isKycReviewer = hasAnyRole(requesterRoles, KYC_ROLE_VALUES);

    if (!isSelfRead && !isKycReviewer) {
      throw new ForbiddenException(
        'Only the subject user or KYC staff can read a KYC record.',
      );
    }

    const record = await this.kycRepo.findOne({ where: { userId } });
    if (!record) {
      throw new NotFoundException(`KYC record not found for user ${userId}.`);
    }
    return record;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private enforceOperatorRole(operator: AuthenticatedOperator): void {
    const roles = this.enforceKycEndpointAccess(operator);

    if (!roles.includes(KycRole.KYC_OPERATOR)) {
      throw new ForbiddenException(
        'Only KYC_OPERATOR role can update KYC status.',
      );
    }
  }

  private enforceKycGovernanceRole(operator: AuthenticatedOperator): void {
    const roles = this.enforceKycEndpointAccess(operator);

    if (!roles.includes(KycRole.KYC_GOVERNANCE)) {
      throw new ForbiddenException(
        'Only KYC_GOVERNANCE role can override terminal states.',
      );
    }
  }

  private enforceKycEndpointAccess(operator: AuthenticatedOperator): string[] {
    if (operator?.id === undefined || operator.id === null || !operator.roles) {
      throw new ForbiddenException('Authenticated KYC actor is required.');
    }

    const roles = normalizeRoleValues(operator.roles);

    try {
      assertNoGovernanceKycRoleConflict(roles);
    } catch (error) {
      if (error instanceof RoleSeparationViolation) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }

    if (hasAnyRole(roles, GOVERNANCE_ROLE_VALUES)) {
      throw new ForbiddenException(
        'Governance roles cannot perform KYC operations.',
      );
    }

    return roles;
  }

  private async findRecordForMutation(
    manager: EntityManager,
    targetUserId: number,
  ): Promise<KycRecord | null> {
    const findOptions: Record<string, unknown> = {
      where: { userId: targetUserId },
    };

    if (this.supportsPessimisticWriteLock()) {
      findOptions.lock = { mode: 'pessimistic_write' };
    }

    return manager.findOne(KycRecord, findOptions);
  }

  private supportsPessimisticWriteLock(): boolean {
    return !['better-sqlite3', 'sqlite', 'sqljs'].includes(
      String(this.dataSource.options.type),
    );
  }

  private preventSelfAssignment(
    operatorId: number,
    targetUserId: number,
  ): void {
    if (operatorId === targetUserId) {
      throw new ForbiddenException(
        'Self-assignment of KYC status is not permitted.',
      );
    }
  }
}
