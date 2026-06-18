/**
 * DEPRECATED: User Role Enumeration
 * This file is kept for backward compatibility only.
 * All role definitions have been moved to src/identity/roles/
 *
 * @deprecated Use src/identity/roles/enums/user-role.enum.ts instead
 */

// Re-export from new location for backward compatibility
export {
  UserRole,
  ROLE_DESCRIPTIONS,
} from '../../identity/roles/enums/user-role.enum';

// Keep console warning for deprecation
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[DEPRECATED] src/common/enums/user-role.enum.ts - ' +
      'Use src/identity/roles/enums/user-role.enum.ts instead. ' +
      'This re-export will be removed in v2.0',
  );
}
