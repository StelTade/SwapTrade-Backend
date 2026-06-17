/**
 * Identity Permissions Module
 * Permission definitions, permission checks, authorization
 *
 * @module identity/permissions
 */

// Module
export { PermissionsModule } from './permissions.module';

// Guards
export { PermissionsGuard } from './guards/permissions.guard';
export { AdminGuard } from '../../common/guards/admin.guard';

// Decorators
export { RequirePermissions } from './decorators/permissions.decorator';

// Constants
export {
  ALL_PERMISSIONS,
  USERS_READ,
  USERS_WRITE,
  ACCOUNTS_READ,
  ACCOUNTS_WRITE,
  TRADES_READ,
  TRADES_WRITE,
  ADMIN_ACCESS,
  COMPLIANCE_READ,
  COMPLIANCE_WRITE,
  AUDIT_READ,
  PROFILE_READ,
  PROFILE_WRITE,
  PORTFOLIO_READ,
  PORTFOLIO_WRITE,
  SUPPORT_TICKETS_MANAGE,
} from './constants/permissions';