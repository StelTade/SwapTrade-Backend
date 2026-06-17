import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_METADATA_KEY = 'rbac_roles';

/**
 * Route-level decorator for role-based access control.
 *
 * @example
 * \@Roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
 * \@Get('sensitive-data')
 * getData() { ... }
 */
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
