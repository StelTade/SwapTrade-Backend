import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '../../../user/entities/user.entity';
import { UserRole } from '../../roles/enums/user-role.enum';
import { SuspendUserDto, ActivateUserDto } from '../dto/suspend-user.dto';
import { UserQueryDto } from '../dto/user-query.dto';
import { AuditLogService } from '../../../audit-log/audit-log.service';
import { AuditEventType, AuditSeverity } from '../../../common/security/audit-log.entity';

/** Events emitted by this service */
export class UserSuspendedEvent {
  constructor(
    public readonly userId: number,
    public readonly reason: string,
    public readonly actorId: string,
  ) {}
}

export class UserActivatedEvent {
  constructor(
    public readonly userId: number,
    public readonly actorId: string,
  ) {}
}

@Injectable()
export class IdentityAdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditLog: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── User Management ──────────────────────────────────────────────────────────

  async listUsers(query: UserQueryDto): Promise<{
    data: Partial<User>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 25, role, isSuspended, search } = query;

    const qb = this.userRepo.createQueryBuilder('user');

    if (role) {
      // simple-array column — use LIKE
      qb.andWhere('user.roles LIKE :role', { role: `%${role}%` });
    }

    if (isSuspended !== undefined) {
      qb.andWhere('user.isSuspended = :isSuspended', { isSuspended });
    }

    if (search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.username ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Strip sensitive fields
    const safeData = data.map(({ mfaSecret, mfaRecoveryCodes, ...rest }) => rest);

    return {
      data: safeData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUser(userId: number): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    const { mfaSecret, mfaRecoveryCodes, ...safe } = user;
    return safe;
  }

  // ─── Account Suspension ───────────────────────────────────────────────────────

  async suspendUser(dto: SuspendUserDto, actorId: string): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);

    if (user.isSuspended) {
      throw new BadRequestException(`User ${dto.userId} is already suspended`);
    }

    // Prevent suspending a SUPER_ADMIN
    if (user.roles.includes(UserRole.SUPER_ADMIN)) {
      throw new BadRequestException('SUPER_ADMIN accounts cannot be suspended');
    }

    const beforeState = {
      isSuspended: user.isSuspended,
      suspensionReason: user.suspensionReason,
    };

    user.isSuspended = true;
    user.suspendedAt = new Date();
    user.suspensionReason = dto.reason;
    user.suspensionExpiresAt = dto.durationHours
      ? new Date(Date.now() + dto.durationHours * 3_600_000)
      : null;

    const savedUser = await this.userRepo.save(user);

    await this.auditLog.log({
      userId: actorId,
      eventType: AuditEventType.USER_SUSPENDED,
      severity: AuditSeverity.WARNING,
      entityType: 'user',
      entityId: String(dto.userId),
      beforeState,
      afterState: {
        isSuspended: true,
        suspensionReason: dto.reason,
        suspensionExpiresAt: user.suspensionExpiresAt,
      },
      metadata: { reason: dto.reason, durationHours: dto.durationHours, actorId },
    });

    this.eventEmitter.emit(
      'user.suspended',
      new UserSuspendedEvent(dto.userId, dto.reason, actorId),
    );

    const { mfaSecret, mfaRecoveryCodes, ...safe } = savedUser;
    return safe;
  }

  async activateUser(dto: ActivateUserDto, actorId: string): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);

    if (!user.isSuspended) {
      throw new BadRequestException(`User ${dto.userId} is not suspended`);
    }

    const beforeState = {
      isSuspended: user.isSuspended,
      suspensionReason: user.suspensionReason,
    };

    user.isSuspended = false;
    user.suspendedAt = null;
    user.suspensionReason = null;
    user.suspensionExpiresAt = null;

    const savedUser = await this.userRepo.save(user);

    await this.auditLog.log({
      userId: actorId,
      eventType: AuditEventType.USER_ACTIVATED,
      severity: AuditSeverity.INFO,
      entityType: 'user',
      entityId: String(dto.userId),
      beforeState,
      afterState: { isSuspended: false },
      metadata: { notes: dto.notes, actorId },
    });

    this.eventEmitter.emit(
      'user.activated',
      new UserActivatedEvent(dto.userId, actorId),
    );

    const { mfaSecret, mfaRecoveryCodes, ...safe } = savedUser;
    return safe;
  }

  // ─── Administrative Stats ─────────────────────────────────────────────────────

  async getAdminDashboardStats(): Promise<{
    totalUsers: number;
    suspendedUsers: number;
    usersByRole: Record<string, number>;
  }> {
    const totalUsers = await this.userRepo.count();
    const suspendedUsers = await this.userRepo.count({
      where: { isSuspended: true },
    });

    // Count by each role using raw query for simple-array column
    const usersByRole: Record<string, number> = {};
    for (const role of Object.values(UserRole)) {
      usersByRole[role] = await this.userRepo
        .createQueryBuilder('user')
        .where('user.roles LIKE :role', { role: `%${role}%` })
        .getCount();
    }

    return { totalUsers, suspendedUsers, usersByRole };
  }
}
