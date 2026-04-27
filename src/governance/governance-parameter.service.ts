import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import {
  AuthenticatedActor,
  RoleSeparationViolation,
  SecurityRole,
  assertGovernanceActor,
} from '../common/security/role-separation';
import { AuditService } from '../platform/audit.service';
import { QueueParameterUpdateDto } from './dto/queue-parameter-update.dto';
import { GovernanceParameter } from './entities/governance-parameter.entity';
import {
  ParameterUpdateStatus,
  PendingGovernanceParameterUpdate,
} from './entities/pending-governance-parameter-update.entity';
import {
  GovernanceParameterKey,
  applyParameterPatch,
  assertKnownParameterKey,
  assertOnlyPatchedFieldsChanged,
  clonePlainObject,
  getDefaultParameterValue,
  validateParameterPatch,
} from './governance-parameter-definitions';

const DEFAULT_MINIMUM_TIMELOCK_MS = 60_000;
const SYSTEM_GOVERNANCE_ACTOR: AuthenticatedActor = {
  id: 0,
  roles: [SecurityRole.GOVERNANCE_OPERATOR],
};

@Injectable()
export class GovernanceParameterService {
  private readonly logger = new Logger(GovernanceParameterService.name);
  private readonly minimumTimelockMs = this.resolveMinimumTimelockMs();

  constructor(
    @InjectRepository(PendingGovernanceParameterUpdate)
    private readonly updateRepository: Repository<PendingGovernanceParameterUpdate>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  getMinimumTimelockMs(): number {
    return this.minimumTimelockMs;
  }

  async getParameter(parameterKey: string): Promise<GovernanceParameter> {
    assertKnownParameterKey(parameterKey);

    return this.dataSource.transaction((manager) =>
      this.findOrCreateParameter(manager, parameterKey),
    );
  }

  async queueParameterUpdate(
    dto: QueueParameterUpdateDto,
    actor: AuthenticatedActor,
    now = new Date(),
  ): Promise<PendingGovernanceParameterUpdate> {
    this.enforceGovernanceActor(actor);
    assertKnownParameterKey(dto.parameterKey);

    const delayMs = dto.delayMs ?? this.minimumTimelockMs;
    if (delayMs < this.minimumTimelockMs) {
      throw new BadRequestException(
        `Parameter updates require a minimum timelock of ${this.minimumTimelockMs}ms.`,
      );
    }

    const patch = validateParameterPatch(dto.parameterKey, dto.patch);
    const executeAfter = new Date(now.getTime() + delayMs);

    const queuedUpdate = await this.dataSource.transaction(async (manager) => {
      const parameter = await this.findOrCreateParameter(manager, dto.parameterKey);
      const beforeValue = clonePlainObject(parameter.value);
      const afterValue = applyParameterPatch(beforeValue, patch);
      assertOnlyPatchedFieldsChanged(beforeValue, afterValue, patch);

      const update = manager.create(PendingGovernanceParameterUpdate, {
        parameterKey: dto.parameterKey,
        patch,
        status: ParameterUpdateStatus.QUEUED,
        requestedBy: actor.id,
        minimumDelayMs: this.minimumTimelockMs,
        executeAfter,
        beforeValue,
        afterValue,
      });

      return manager.save(PendingGovernanceParameterUpdate, update);
    });

    await this.audit('parameter_update.queued', actor.id, queuedUpdate.id, {
      parameterKey: queuedUpdate.parameterKey,
      executeAfter: queuedUpdate.executeAfter.toISOString(),
      patch,
    });

    return queuedUpdate;
  }

  async executeParameterUpdate(
    updateId: string,
    actor: AuthenticatedActor,
    now = new Date(),
  ): Promise<{
    parameter: GovernanceParameter;
    update: PendingGovernanceParameterUpdate;
  }> {
    this.enforceGovernanceActor(actor);

    const result = await this.dataSource.transaction(async (manager) => {
      const update = await this.findUpdateForMutation(manager, updateId);

      if (!update) {
        throw new BadRequestException(`Parameter update ${updateId} was not found.`);
      }

      if (update.status !== ParameterUpdateStatus.QUEUED) {
        throw new BadRequestException(
          `Parameter update ${updateId} is ${update.status} and cannot be executed.`,
        );
      }

      if (now < update.executeAfter) {
        throw new BadRequestException('Timelock delay has not elapsed.');
      }

      assertKnownParameterKey(update.parameterKey);
      const patch = validateParameterPatch(update.parameterKey, update.patch);
      const parameter = await this.findOrCreateParameter(manager, update.parameterKey);
      const currentValue = clonePlainObject(parameter.value);

      if (!this.valuesEqual(currentValue, update.beforeValue)) {
        throw new ConflictException(
          'Parameter state changed since this update was queued.',
        );
      }

      const expectedAfterValue = applyParameterPatch(currentValue, patch);
      if (!this.valuesEqual(expectedAfterValue, update.afterValue)) {
        throw new BadRequestException(
          'Queued parameter update no longer matches its validated post-state.',
        );
      }

      parameter.value = expectedAfterValue;
      parameter.version += 1;
      parameter.updatedBy = actor.id;
      parameter.lastAppliedUpdateId = update.id;

      const savedParameter = await manager.save(GovernanceParameter, parameter);
      const savedValue = clonePlainObject(savedParameter.value);
      const changedFields = assertOnlyPatchedFieldsChanged(
        currentValue,
        savedValue,
        patch,
      );

      update.status = ParameterUpdateStatus.EXECUTED;
      update.executedAt = now;
      update.executedBy = actor.id;
      update.executionResult = {
        changedFields,
        beforeValue: currentValue,
        afterValue: savedValue,
      };

      const savedUpdate = await manager.save(PendingGovernanceParameterUpdate, update);

      return {
        parameter: savedParameter,
        update: savedUpdate,
      };
    });

    await this.audit('parameter_update.executed', actor.id, updateId, {
      parameterKey: result.update.parameterKey,
      changedFields: result.update.executionResult?.changedFields,
    });

    return result;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async executeReadyParameterUpdates(now = new Date()): Promise<void> {
    const readyUpdates = await this.updateRepository.find({
      where: {
        status: ParameterUpdateStatus.QUEUED,
        executeAfter: LessThanOrEqual(now),
      },
      order: { executeAfter: 'ASC' },
    });

    for (const update of readyUpdates) {
      try {
        await this.executeParameterUpdate(update.id, SYSTEM_GOVERNANCE_ACTOR, now);
      } catch (error) {
        await this.markUpdateFailed(update.id, error);
      }
    }
  }

  private async findOrCreateParameter(
    manager: EntityManager,
    key: GovernanceParameterKey,
  ): Promise<GovernanceParameter> {
    const existing = await this.findParameterForMutation(manager, key);
    if (existing) {
      return existing;
    }

    const parameter = manager.create(GovernanceParameter, {
      key,
      value: getDefaultParameterValue(key),
      version: 1,
    });

    return manager.save(GovernanceParameter, parameter);
  }

  private async findParameterForMutation(
    manager: EntityManager,
    key: string,
  ): Promise<GovernanceParameter | null> {
    const findOptions: Record<string, unknown> = { where: { key } };
    if (this.supportsPessimisticWriteLock()) {
      findOptions.lock = { mode: 'pessimistic_write' };
    }

    return manager.findOne(GovernanceParameter, findOptions);
  }

  private async findUpdateForMutation(
    manager: EntityManager,
    updateId: string,
  ): Promise<PendingGovernanceParameterUpdate | null> {
    const findOptions: Record<string, unknown> = { where: { id: updateId } };
    if (this.supportsPessimisticWriteLock()) {
      findOptions.lock = { mode: 'pessimistic_write' };
    }

    return manager.findOne(PendingGovernanceParameterUpdate, findOptions);
  }

  private async markUpdateFailed(updateId: string, error: unknown): Promise<void> {
    const failureReason = error instanceof Error ? error.message : String(error);

    await this.updateRepository.update(updateId, {
      status: ParameterUpdateStatus.FAILED,
      failureReason,
    });

    this.logger.error(`Failed to execute parameter update ${updateId}: ${failureReason}`);
  }

  private enforceGovernanceActor(actor: AuthenticatedActor): void {
    try {
      assertGovernanceActor(actor);
    } catch (error) {
      if (error instanceof RoleSeparationViolation) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }

  private supportsPessimisticWriteLock(): boolean {
    return !['better-sqlite3', 'sqlite', 'sqljs'].includes(
      String(this.dataSource.options.type),
    );
  }

  private resolveMinimumTimelockMs(): number {
    const configuredValue = Number(process.env.GOVERNANCE_PARAMETER_TIMELOCK_MS);

    if (Number.isFinite(configuredValue) && configuredValue >= 0) {
      return configuredValue;
    }

    return DEFAULT_MINIMUM_TIMELOCK_MS;
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private async audit(
    action: string,
    actorUserId: number,
    entityId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService?.log({
      domain: 'governance',
      action,
      actorUserId,
      entityId,
      metadata,
    });
  }
}
