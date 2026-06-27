import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Permission } from '../entities/permission.entity';
import {
  PERMISSION_REGISTRY,
  PermissionDefinition,
} from '../constants/permission-registry';
import { AuditLogService } from '../../../audit-log/audit-log.service';
import {
  AuditEventType,
  AuditSeverity,
} from '../../../common/security/audit-log.entity';

export class PermissionGrantedEvent {
  constructor(
    public readonly roleId: string,
    public readonly permissionSlug: string,
    public readonly actorId: string,
  ) {}
}

export class PermissionRevokedEvent {
  constructor(
    public readonly roleId: string,
    public readonly permissionSlug: string,
    public readonly actorId: string,
  ) {}
}

@Injectable()
export class PermissionManagementService implements OnModuleInit {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    private readonly auditLog: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Seed all permissions from the registry on startup */
  async onModuleInit(): Promise<void> {
    await this.seedPermissions();
  }

  async seedPermissions(): Promise<void> {
    for (const def of PERMISSION_REGISTRY) {
      const existing = await this.permissionRepo.findOne({
        where: { slug: def.slug },
      });
      if (existing) continue;

      await this.permissionRepo.save(
        this.permissionRepo.create({
          resource: def.resource,
          action: def.action,
          slug: def.slug,
          description: def.description,
          isActive: true,
        }),
      );
    }
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionRepo.find({
      where: { isActive: true },
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<Permission> {
    const permission = await this.permissionRepo.findOne({ where: { slug } });
    if (!permission)
      throw new NotFoundException(`Permission '${slug}' not found`);
    return permission;
  }

  async findBySlugs(slugs: string[]): Promise<Permission[]> {
    return this.permissionRepo
      .createQueryBuilder('p')
      .where('p.slug IN (:...slugs)', { slugs })
      .andWhere('p.isActive = true')
      .getMany();
  }

  async create(
    def: PermissionDefinition,
    actorId: string,
  ): Promise<Permission> {
    const existing = await this.permissionRepo.findOne({
      where: { slug: def.slug },
    });
    if (existing)
      throw new ConflictException(`Permission '${def.slug}' already exists`);

    const permission = await this.permissionRepo.save(
      this.permissionRepo.create({
        resource: def.resource,
        action: def.action,
        slug: def.slug,
        description: def.description,
        isActive: true,
      }),
    );

    await this.auditLog.log({
      userId: actorId,
      eventType: AuditEventType.PERMISSION_GRANTED,
      severity: AuditSeverity.INFO,
      entityType: 'permission',
      entityId: permission.id,
      metadata: { slug: def.slug, actorId },
    });

    return permission;
  }

  async deactivate(slug: string, actorId: string): Promise<Permission> {
    const permission = await this.findBySlug(slug);
    permission.isActive = false;
    const saved = await this.permissionRepo.save(permission);

    await this.auditLog.log({
      userId: actorId,
      eventType: AuditEventType.PERMISSION_REVOKED,
      severity: AuditSeverity.WARNING,
      entityType: 'permission',
      entityId: permission.id,
      metadata: { slug, actorId },
    });

    this.eventEmitter.emit(
      'permission.revoked',
      new PermissionRevokedEvent(permission.id, slug, actorId),
    );

    return saved;
  }

  /**
   * Validate that all provided slugs exist in the registry.
   * Returns missing slugs.
   */
  validateSlugs(slugs: string[]): string[] {
    return slugs.filter(
      (slug) => !PERMISSION_REGISTRY.find((p) => p.slug === slug),
    );
  }
}
