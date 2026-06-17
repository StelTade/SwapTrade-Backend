import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../user/entities/user.entity';
import { UserRole } from '../../roles/enums/user-role.enum';
import { RoleService } from '../../roles/services/role.service';
import { areRolesCompatible } from '../../roles/constants/role-hierarchy';
import { AuditService } from '../../../common/logging/audit_service';
import { RoleAssignmentDto } from '../dto/role-assignment.dto';

@Injectable()
export class RoleManagementService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly roleService: RoleService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Assign a role to a user
   * Performs role compatibility checks and publishes RoleAssigned event
   */
  async assignRole(userId: number, dto: RoleAssignmentDto, assignedBy: { id: number; roles: UserRole[] }): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if assigner has permission to manage roles
    if (!this.roleService.hasPermission(assignedBy.roles, 'users.write')) {
      throw new ForbiddenException('Insufficient permissions to assign roles');
    }

    const newRole = dto.role as UserRole;
    
    // Check role compatibility with existing roles
    for (const existingRole of user.roles) {
      if (!areRolesCompatible(existingRole, newRole)) {
        throw new BadRequestException(`Role ${newRole} is incompatible with existing role ${existingRole}`);
      }
    }

    // Add role if not already assigned
    if (!user.roles.includes(newRole)) {
      user.roles.push(newRole);
      await this.userRepo.save(user);

      // Log audit event
      await this.auditService.createEntry({
        userId: assignedBy.id,
        eventType: 'RoleAssigned',
        entityType: 'user',
        entityId: userId.toString(),
        metadata: { role: newRole, previousRoles: [...user.roles] },
      });
    }

    return user;
  }

  /**
   * Revoke a role from a user
   * Publishes RoleRevoked event
   */
  async revokeRole(userId: number, roleToRevoke: UserRole, revokedBy: { id: number; roles: UserRole[] }): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if revoker has permission to manage roles
    if (!this.roleService.hasPermission(revokedBy.roles, 'users.write')) {
      throw new ForbiddenException('Insufficient permissions to revoke roles');
    }

    const roleIndex = user.roles.indexOf(roleToRevoke);
    if (roleIndex === -1) {
      throw new BadRequestException(`User does not have role ${roleToRevoke}`);
    }

    // Prevent removing the last remaining role
    if (user.roles.length === 1) {
      throw new BadRequestException('Cannot revoke the user\'s only role');
    }

    user.roles.splice(roleIndex, 1);
    await this.userRepo.save(user);

    // Log audit event
    await this.auditService.createEntry({
      userId: revokedBy.id,
      eventType: 'RoleRevoked',
      entityType: 'user',
      entityId: userId.toString(),
      metadata: { role: roleToRevoke, newRoles: [...user.roles] },
    });

    return user;
  }

  /**
   * Get all roles assigned to a user
   */
  async getUserRoles(userId: number): Promise<UserRole[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.roles;
  }

  /**
   * Suspend a user account
   * Publishes UserSuspended event
   */
  async suspendUser(userId: number, suspendedBy: { id: number; roles: UserRole[] }, reason: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.roleService.hasPermission(suspendedBy.roles, 'users.write')) {
      throw new ForbiddenException('Insufficient permissions to suspend users');
    }

    // Add isSuspended flag if not exists (would typically be in user entity)
    (user as any).isSuspended = true;
    (user as any).suspensionReason = reason;
    (user as any).suspendedAt = new Date();
    await this.userRepo.save(user);

    await this.auditService.createEntry({
      userId: suspendedBy.id,
      eventType: 'UserSuspended',
      entityType: 'user',
      entityId: userId.toString(),
      metadata: { reason },
    });

    return user;
  }

  /**
   * Activate a previously suspended user
   * Publishes UserActivated event
   */
  async activateUser(userId: number, activatedBy: { id: number; roles: UserRole[] }): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.roleService.hasPermission(activatedBy.roles, 'users.write')) {
      throw new ForbiddenException('Insufficient permissions to activate users');
    }

    (user as any).isSuspended = false;
    (user as any).suspensionReason = null;
    (user as any).suspendedAt = null;
    await this.userRepo.save(user);

    await this.auditService.createEntry({
      userId: activatedBy.id,
      eventType: 'UserActivated',
      entityType: 'user',
      entityId: userId.toString(),
      metadata: {},
    });

    return user;
  }
}