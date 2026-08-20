import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../identity/roles/enums/user-role.enum';
import { ROLES_METADATA_KEY } from '../../identity/roles/decorators/roles.decorator';
import { JwtPayload } from './jwt-auth.guard';

/**
 * Roles Guard - enforces role-based access control
 * 
 * Checks if the authenticated user has the required roles
 * to access a protected endpoint
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userRoles: UserRole[] = user.roles as UserRole[] || [user.role as UserRole];

    // SUPER_ADMIN and ADMIN bypass all role checks
    if (
      userRoles.includes(UserRole.SUPER_ADMIN) ||
      userRoles.includes(UserRole.ADMIN)
    ) {
      return true;
    }

    // Check if user has at least one of the required roles
    const hasRole = requiredRoles.some((requiredRole) =>
      userRoles.includes(requiredRole),
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
