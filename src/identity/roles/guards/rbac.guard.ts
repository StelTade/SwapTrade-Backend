import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_METADATA_KEY } from '../../permissions/decorators/require-permissions.decorator';
import { RoleService } from '../services/role.service';
import {
  assertNoGovernanceKycRoleConflict,
  RoleSeparationViolation,
  normalizeRoleValues,
} from '../../../common/security/role-separation';

/**
 * RBAC Guard — enforces both role-based and permission-based access control.
 *
 * Checks (in order):
 *  1. If neither @Roles nor @RequirePermissions is present → allow (public)
 *  2. Authenticated user must exist on request
 *  3. Role separation constraints (governance vs KYC)
 *  4. SUPER_ADMIN and ADMIN bypass all further checks
 *  5. @Roles — user must hold at least one of the required roles (or inherit it)
 *  6. @RequirePermissions — user must hold all listed permission slugs
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No restrictions → public route
    if (!requiredRoles?.length && !requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const userRoles: UserRole[] = normalizeRoleValues(
      user.roles?.length ? user.roles : user.role,
    ) as UserRole[];

    // Enforce governance/KYC separation
    try {
      assertNoGovernanceKycRoleConflict(userRoles);
    } catch (err) {
      if (err instanceof RoleSeparationViolation) {
        throw new ForbiddenException(err.message);
      }
      throw err;
    }

    // SUPER_ADMIN and ADMIN bypass all checks
    if (
      userRoles.includes(UserRole.SUPER_ADMIN) ||
      userRoles.includes(UserRole.ADMIN)
    ) {
      return true;
    }

    // Role check
    if (requiredRoles?.length) {
      const hasRole = requiredRoles.some((required) =>
        this.roleService.hasRole(userRoles, required),
      );
      if (!hasRole) {
        throw new ForbiddenException(
          `Access denied. Required roles: [${requiredRoles.join(', ')}]`,
        );
      }
    }

    // Permission check
    if (requiredPermissions?.length) {
      const hasAll = requiredPermissions.every((perm) =>
        this.roleService.hasPermission(userRoles, perm),
      );
      if (!hasAll) {
        throw new ForbiddenException(
          `Access denied. Required permissions: [${requiredPermissions.join(', ')}]`,
        );
      }
    }

    return true;
  }
}
