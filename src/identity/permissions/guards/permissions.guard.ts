import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RoleService } from '../../roles/services/role.service';
import { UserRole } from '../../roles/enums/user-role.enum';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    roles: UserRole[];
    role?: UserRole;
  };
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userRoles: UserRole[] = user.roles || (user.role ? [user.role] : []);

    for (const permission of requiredPermissions) {
      if (!this.roleService.hasPermission(userRoles, permission)) {
        throw new ForbiddenException(
          `Insufficient permissions: ${permission} is required`,
        );
      }
    }

    return true;
  }
}
