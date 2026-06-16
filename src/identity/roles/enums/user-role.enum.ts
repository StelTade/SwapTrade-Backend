/**
 * User Role Enumeration
 * Centralized role definitions for the identity domain
 * Migrated from: src/common/enums/user-role.enum.ts
 *
 * @module identity/roles
 */

/**
 * All available user roles in the system
 * Roles form a hierarchy for permission inheritance
 */
export enum UserRole {
  // Platform-wide roles
  ADMIN = 'ADMIN',
  USER = 'USER',
  STAFF = 'STAFF',

  // Specialized governance roles
  GOVERNANCE_OPERATOR = 'GOVERNANCE_OPERATOR',

  // KYC-specific roles (mutually exclusive with governance)
  KYC_OPERATOR = 'KYC_OPERATOR',
  KYC_GOVERNANCE = 'KYC_GOVERNANCE',
}

/**
 * Human-readable descriptions for each role
 * Used for UI display and documentation
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator - Full system access',
  [UserRole.USER]: 'Standard user - Trading and account access',
  [UserRole.STAFF]: 'Staff member - Support and monitoring',
  [UserRole.GOVERNANCE_OPERATOR]:
    'Governance operator - Policy enforcement',
  [UserRole.KYC_OPERATOR]: 'KYC operator - Document review',
  [UserRole.KYC_GOVERNANCE]: 'KYC governance - Process oversight',
};

export const ALL_ROLES: UserRole[] = Object.values(UserRole);