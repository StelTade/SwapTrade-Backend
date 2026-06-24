import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RoleEntity } from '../entities/role.entity';
import { Permission } from '../../permissions/entities/permission.entity';
import { User } from '../../../user/entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { CreateRoleDto } from '../dto/create-role.dto';
import { AssignRoleDto, RevokeRoleDto } from '../dto/assign-role.dto';
import { RoleService } from './role.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';
import {
  AuditEventType,
  AuditSeverity,
} from '../../../common/security/audit-log.entity';
import { ROLE_HIERARCHY, ROLE_PRIORITY } from '../constants/role-hierarchy';
import { ROLE_METADATA } from '../types/role-metadata';

/** Events emitted by this service */
export class RoleAssignedEvent {
  constructor(
    public readonly userId: string,
    public readonly roles: UserRole[],
    public readonly actorId: string,
  ) {}
}

export class RoleRevokedEvent {
  constructor(
    public readonly userId: string,
    public readonly roles: UserRole[],
    public readonly actorId: string,
  ) {}
}

@Injectable()
export class RoleManagementService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly roleService: RoleService,
    private readonly auditLog: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Role CRUD ───────────────────────────────────────────────────────────────

  async seedDefaultRoles(): Promise<void> {
    for (const role of Object.values(UserRole)) {
      const existing = await this.roleRepo.findOne({ where: { name: role } });
      if (existing) continue;

      const meta = ROLE_METADATA[role];
      const inherits = (ROLE_HIERARCHY[role] ?? []) as string[];

      await this.roleRepo.save(
        this.roleRepo.create({
          name: role,
          description: meta?.description ?? role,
          priority: ROLE_PRIORITY[role] ?? meta?.priority ?? 0,
          isActive: true,
          inheritsFrom: inherits,
        }),
      );
    }
  }

  async findAll(): Promise<RoleEntity[]> {
    return this.roleRepo.find({ order: { priority: 'DESC' } });
  }

  async findOne(name: UserRole): Promise<RoleEntity> {
    const role = await this.roleRepo.findOne({ where: { name } });
    if (!role) throw new NotFoundException(`Role ${name} not found`);
    return role;
  }

  async create(dto: CreateRoleDto): Promise<RoleEntity> {
    const existing = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (existing)
      throw new ConflictException(`Role ${dto.name} already exists`);

    let permissions: Permission[] = [];
    if (dto.permissionSlugs?.length) {
      permissions = await this.permissionRepo.findByIds(dto.permissionSlugs);
    }

    const role = this.roleRepo.create({
      name: dto.name,
      description: dto.description,
      priority: dto.priority ?? 0,
      inheritsFrom: dto.inheritsFrom ?? [],
      permissions,
    });

    return this.roleRepo.save(role);
  }

  async assignPermissionsToRole(
    roleName: UserRole,
    permissionSlugs: string[],
  ): Promise<RoleEntity> {
    const role = await this.findOne(roleName);
    const permissions = await this.permissionRepo
      .createQueryBuilder('p')
      .where('p.slug IN (:...slugs)', { slugs: permissionSlugs })
      .getMany();

    const missing = permissionSlugs.filter(
      (slug) => !permissions.find((p) => p.slug === slug),
    );
    if (missing.length) {
      throw new NotFoundException(
        `Permissions not found: ${missing.join(', ')}`,
      );
    }

    // Merge without duplicates
    const existing = role.permissions ?? [];
    const existingSlugs = existing.map((p) => p.slug);
    const newPerms = permissions.filter((p) => !existingSlugs.includes(p.slug));
    role.permissions = [...existing, ...newPerms];

    return this.roleRepo.save(role);
  }

  async revokePermissionsFromRole(
    roleName: UserRole,
    permissionSlugs: string[],
  ): Promise<RoleEntity> {
    const role = await this.findOne(roleName);
    role.permissions = (role.permissions ?? []).filter(
      (p) => !permissionSlugs.includes(p.slug),
    );
    return this.roleRepo.save(role);
  }

  // ─── User Role Assignment ────────────────────────────────────────────────────

  async assignRolesToUser(dto: AssignRoleDto, actorId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: String(dto.userId) },
    });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);

    const validation = this.roleService.validateRoleCombination([
      ...user.roles,
      ...dto.roles,
    ]);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    const beforeState = { roles: [...user.roles] };
    const combinedRoles = Array.from(new Set([...user.roles, ...dto.roles]));
    user.roles = combinedRoles;
    user.role = this.roleService.getHighestPriorityRole(user.roles);

    const savedUser = await this.userRepo.save(user);

    await this.auditLog.log({
      userId: actorId,
      eventType: AuditEventType.ROLE_ASSIGNED,
      severity: AuditSeverity.WARNING,
      entityType: 'user',
      entityId: String(dto.userId),
      beforeState,
      afterState: { roles: user.roles },
      metadata: { assignedRoles: dto.roles, actorId },
    });

    this.eventEmitter.emit(
      'role.assigned',
      new RoleAssignedEvent(String(dto.userId), dto.roles, actorId),
    );

    return savedUser;
  }

  async revokeRolesFromUser(
    dto: RevokeRoleDto,
    actorId: string,
  ): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: String(dto.userId) },
    });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);

    const beforeState = { roles: [...user.roles] };
    user.roles = user.roles.filter((r) => !dto.roles.includes(r));

    // Always keep at least USER role
    if (user.roles.length === 0) {
      user.roles = [UserRole.USER];
    }
    user.role = this.roleService.getHighestPriorityRole(user.roles);

    const savedUser = await this.userRepo.save(user);

    await this.auditLog.log({
      userId: actorId,
      eventType: AuditEventType.ROLE_REVOKED,
      severity: AuditSeverity.WARNING,
      entityType: 'user',
      entityId: String(dto.userId),
      beforeState,
      afterState: { roles: user.roles },
      metadata: { revokedRoles: dto.roles, actorId },
    });

    this.eventEmitter.emit(
      'role.revoked',
      new RoleRevokedEvent(String(dto.userId), dto.roles, actorId),
    );

    return savedUser;
  }

  async getUserRoles(userId: string): Promise<{
    roles: UserRole[];
    primaryRole: UserRole;
    permissions: string[];
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const context = this.roleService.createRoleContext(user.roles);
    const permissions = Array.from(
      this.roleService.getAllUserPermissions(user.roles),
    );

    return {
      roles: user.roles,
      primaryRole: context.primaryRole,
      permissions,
    };
  }
}
