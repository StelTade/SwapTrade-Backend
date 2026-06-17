/**
 * Role Metadata Types and Definitions
 * Defines role capabilities, constraints, and context
 *
 * @module identity/roles/types
 */

import { UserRole } from '../enums/user-role.enum';
import { getInheritedRoles } from '../constants/role-hierarchy';

/**
 * Metadata for a specific role
 * Includes capabilities, permissions, and constraints
 */
export interface RoleMetadata {
  /** Role name/identifier */
  name: UserRole;

  /** Human-readable description */
  description: string;

  /** Priority level (higher = more privileged) */
  priority: number;

  /** List of permissions granted by this role */
  permissions: string[];

  /** Optional role-specific constraints */
  constraints?: {
    /** Maximum number of users with this role */
    maxUsers?: number;

    /** Maximum actions per day for users with this role */
    maxDailyActions?: number;

    /** IP addresses allowed for this role */
    ipWhitelist?: string[];

    /** Time-based restrictions (e.g., "9-17 weekdays") */
    timeRestrictions?: string;
  };
}

/**
 * Role context for a user
 * Contains all role information relevant to a user
 */
export interface RoleContext {
  /** All roles assigned to the user */
  roles: UserRole[];

  /** Highest priority role (primary role) */
  primaryRole: UserRole;

  /** All inherited roles from primary role */
  inheritedRoles: UserRole[];
}

/**
 * Complete metadata for all roles in the system
 * Defines what each role can do
 */
export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  [UserRole.SUPER_ADMIN]: {
    name: UserRole.SUPER_ADMIN,
    description: 'Super Administrator - Complete system root access',
    priority: 200,
    permissions: ['*'],
    constraints: {
      maxUsers: 1,
      maxDailyActions: undefined, // Unlimited
      timeRestrictions: '24/7',
    },
  },
  [UserRole.ADMIN]: {
    name: UserRole.ADMIN,
    description: 'Administrator - Full system access',
    priority: 150,
    permissions: ['admin.access', 'users.read', 'users.write', 'accounts.read', 'accounts.write', 'trades.read', 'trades.write', '*'],
    constraints: {
      maxUsers: 5,
      maxDailyActions: undefined, // Unlimited
      timeRestrictions: '24/7',
    },
  },
  [UserRole.COMPLIANCE_OFFICER]: {
    name: UserRole.COMPLIANCE_OFFICER,
    description: 'Compliance Officer - Regulatory monitoring and enforcement',
    priority: 120,
    permissions: ['admin.access', 'users.read', 'accounts.read', 'trades.read', 'compliance.read', 'compliance.write', 'audit.read'],
    constraints: {
      maxUsers: 10,
      maxDailyActions: 1000,
      timeRestrictions: '24/7',
    },
  },
  [UserRole.SUPPORT_AGENT]: {
    name: UserRole.SUPPORT_AGENT,
    description: 'Support Agent - User assistance and account troubleshooting',
    priority: 100,
    permissions: ['admin.access', 'users.read', 'accounts.read', 'support.tickets.manage'],
    constraints: {
      maxUsers: 50,
      maxDailyActions: 5000,
      timeRestrictions: '9-17 weekdays',
    },
  },
  [UserRole.TRADER]: {
    name: UserRole.TRADER,
    description: 'Trader - Advanced trading capabilities and portfolio management',
    priority: 40,
    permissions: ['trades.read', 'trades.write', 'accounts.read', 'accounts.write', 'portfolio.read', 'portfolio.write'],
    constraints: {
      maxUsers: undefined, // Unlimited
      maxDailyActions: 10000,
    },
  },
  [UserRole.USER]: {
    name: UserRole.USER,
    description: 'Standard platform user - Trading and account access',
    priority: 20,
    permissions: ['trades.read', 'trades.write', 'accounts.read', 'accounts.write', 'profile.read', 'profile.write'],
    constraints: {
      maxUsers: undefined, // Unlimited
      maxDailyActions: 5000,
    },
  },
  [UserRole.GOVERNANCE_OPERATOR]: {
    name: UserRole.GOVERNANCE_OPERATOR,
    description: 'Governance operator - Policy enforcement',
    priority: 80,
    permissions: [
      'POLICY_READ',
      'POLICY_WRITE',
      'AUDIT_READ',
      'GOVERNANCE_RULES_MANAGE',
      'SYSTEM_METRICS_READ',
      'USER_SUSPENSION_REQUEST',
    ],
    constraints: {
      maxUsers: 10,
      maxDailyActions: 500,
    },
  },
  [UserRole.STAFF]: {
    name: UserRole.STAFF,
    description: 'Staff member - Support and monitoring',
    priority: 60,
    permissions: [
      'USER_READ',
      'USER_SUPPORT_TICKET_MANAGE',
      'COMPLIANCE_READ',
      'TRANSACTION_VIEW',
      'ALERT_READ',
      'BALANCE_HISTORY_VIEW',
    ],
    constraints: {
      maxUsers: 50,
      maxDailyActions: 1000,
    },
  },
  [UserRole.KYC_OPERATOR]: {
    name: UserRole.KYC_OPERATOR,
    description: 'KYC operator - Document reviewer',
    priority: 40,
    permissions: [
      'KYC_READ',
      'KYC_REVIEW',
      'KYC_APPROVE',
      'KYC_REJECT',
      'DOCUMENT_VIEW',
      'USER_KYC_STATUS_UPDATE',
    ],
    constraints: {
      maxUsers: 20,
      maxDailyActions: 200,
      timeRestrictions: '9-17 weekdays',
    },
  },
  [UserRole.KYC_GOVERNANCE]: {
    name: UserRole.KYC_GOVERNANCE,
    description: 'KYC governance - Process oversight',
    priority: 70,
    permissions: [
      'KYC_POLICY_READ',
      'KYC_POLICY_WRITE',
      'KYC_AUDIT_READ',
      'KYC_ESCALATE',
      'KYC_OPERATOR_MANAGE',
      'COMPLIANCE_ESCALATE',
      'DOCUMENT_STORAGE_MANAGE',
    ],
    constraints: {
      maxUsers: 5,
      maxDailyActions: 500,
    },
  },
};

/**
 * Get metadata for a specific role
 */
export function getRoleMetadata(role: UserRole): RoleMetadata {
  return ROLE_METADATA[role];
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: UserRole, permission: string): boolean {
  const metadata = ROLE_METADATA[role];
  if (!metadata) {
    return false;
  }

  // Admin has all permissions
  if (metadata.permissions.includes('*')) {
    return true;
  }

  return metadata.permissions.includes(permission);
}

/**
 * Get all permissions for a role (including inherited permissions)
 */
export function getAllRolePermissions(
  role: UserRole,
  inheritedRoles: UserRole[]
): Set<string> {
  const permissions = new Set<string>();

  // Check if role is ADMIN
  if (role === UserRole.ADMIN) {
    return new Set(['*']);
  }

  // Start with the role's own permissions
  const metadata = ROLE_METADATA[role];
  if (metadata && metadata.permissions) {
    metadata.permissions.forEach((perm) => {
      permissions.add(perm);
    });
  }

  // Add permissions from inherited roles
  inheritedRoles.forEach((r) => {
    const inheritedMetadata = ROLE_METADATA[r];
    if (inheritedMetadata && inheritedMetadata.permissions) {
      inheritedMetadata.permissions.forEach((perm) => {
        permissions.add(perm);
      });
    }
  });

  return permissions;
}