/**
 * Roles Module Barrel Export
 * Central export point for all role-related functionality
 *
 * @module identity/roles
 */

// Enums
export { UserRole, ROLE_DESCRIPTIONS } from './enums/user-role.enum';

// Constants
export {
  ROLE_HIERARCHY,
  ROLE_INCOMPATIBILITIES,
  getInheritedRoles,
  areRolesCompatible,
  getRoleIncompatibilities,
} from './constants/role-hierarchy';

// Types and metadata
export {
  ROLE_METADATA,
  getRoleMetadata,
  roleHasPermission,
  getAllRolePermissions,
} from './types/role-metadata';
export type {
  RoleMetadata,
  RoleContext,
} from './types/role-metadata';

// Service
export { RoleService } from './services/role.service';

// Legacy exports (deprecated, kept for backward compatibility)
export { AdminGuard } from '../../common/guards/admin.guard';