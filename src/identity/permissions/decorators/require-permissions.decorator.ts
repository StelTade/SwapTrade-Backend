import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_METADATA_KEY = 'rbac_permissions';

/**
 * Route-level decorator for permission-based access control.
 * Accepts permission slugs in '<resource>.<action>' format.
 *
 * @example
 * \@RequirePermissions('users.read', 'accounts.read')
 * \@Get('users')
 * listUsers() { ... }
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
