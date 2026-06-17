/**
 * Role Hierarchy and Compatibility Rules
 * Defines role inheritance and incompatibility constraints
 *
 * @module identity/roles/constants
 */

import { UserRole } from '../enums/user-role.enum';

/**
 * Role hierarchy definition
 * Each role inherits from its parents in the hierarchy
 * SUPER_ADMIN is at the top with no parents
 *
 * Hierarchy:
 * SUPER_ADMIN (highest — unrestricted)
 *   └─ ADMIN
 *       ├─ COMPLIANCE_OFFICER
 *       ├─ SUPPORT_AGENT
 *       │   └─ STAFF
 *       │       └─ USER (base)
 *       ├─ GOVERNANCE_OPERATOR
 *       │   └─ STAFF
 *       │       └─ USER
 *       └─ KYC_GOVERNANCE
 *           ├─ KYC_OPERATOR
 *           └─ STAFF
 *               └─ USER
 * TRADER inherits USER
 *
 * USER is the base role from which others inherit
 */
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  [UserRole.SUPER_ADMIN]: [],
  [UserRole.ADMIN]: [],
  [UserRole.COMPLIANCE_OFFICER]: [UserRole.STAFF],
  [UserRole.SUPPORT_AGENT]: [UserRole.STAFF],
  [UserRole.GOVERNANCE_OPERATOR]: [UserRole.STAFF],
  [UserRole.STAFF]: [UserRole.USER],
  [UserRole.TRADER]: [UserRole.USER],
  [UserRole.USER]: [],
  [UserRole.KYC_OPERATOR]: [UserRole.USER],
  [UserRole.KYC_GOVERNANCE]: [UserRole.STAFF, UserRole.KYC_OPERATOR],
};

/**
 * Role priority levels (higher = more privileged)
 * Used for access control comparisons
 */
export const ROLE_PRIORITY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 110,
  [UserRole.ADMIN]: 100,
  [UserRole.COMPLIANCE_OFFICER]: 85,
  [UserRole.GOVERNANCE_OPERATOR]: 80,
  [UserRole.KYC_GOVERNANCE]: 70,
  [UserRole.SUPPORT_AGENT]: 65,
  [UserRole.STAFF]: 60,
  [UserRole.KYC_OPERATOR]: 40,
  [UserRole.TRADER]: 30,
  [UserRole.USER]: 20,
};

/**
 * Role separation constraints
 * Roles that cannot be assigned together (mutually exclusive)
 * Used to enforce business rules around governance vs KYC specialization
 */
export const ROLE_INCOMPATIBILITIES: Map<UserRole, UserRole[]> = new Map([
  [
    UserRole.GOVERNANCE_OPERATOR,
    [UserRole.KYC_OPERATOR, UserRole.KYC_GOVERNANCE],
  ],
  [UserRole.KYC_OPERATOR, [UserRole.GOVERNANCE_OPERATOR]],
  [UserRole.KYC_GOVERNANCE, [UserRole.GOVERNANCE_OPERATOR]],
]);

/**
 * Get all inherited roles for a given role
 * Recursively walks up the hierarchy tree
 *
 * Example:
 * getInheritedRoles(UserRole.STAFF) => [UserRole.STAFF, UserRole.USER]
 * getInheritedRoles(UserRole.ADMIN) => [UserRole.ADMIN]
 */
export function getInheritedRoles(role: UserRole): UserRole[] {
  const inherited = [role];
  const parents = ROLE_HIERARCHY[role] || [];

  parents.forEach((parent) => {
    const parentInherited = getInheritedRoles(parent);
    // Avoid duplicates when adding parent inherited roles
    parentInherited.forEach((inheritedRole) => {
      if (!inherited.includes(inheritedRole)) {
        inherited.push(inheritedRole);
      }
    });
  });

  return inherited;
}

/**
 * Check if two roles are compatible (can be assigned together)
 * Returns false if roles are incompatible
 *
 * Example:
 * areRolesCompatible(UserRole.GOVERNANCE_OPERATOR, UserRole.KYC_OPERATOR) => false
 * areRolesCompatible(UserRole.ADMIN, UserRole.USER) => true
 */
export function areRolesCompatible(role1: UserRole, role2: UserRole): boolean {
  if (role1 === role2) {
    return true;
  }

  const incompatible = ROLE_INCOMPATIBILITIES.get(role1) || [];
  const reverseIncompatible = ROLE_INCOMPATIBILITIES.get(role2) || [];

  return !incompatible.includes(role2) && !reverseIncompatible.includes(role1);
}

/**
 * Get incompatibilities for a role
 */
export function getRoleIncompatibilities(role: UserRole): UserRole[] {
  return ROLE_INCOMPATIBILITIES.get(role) || [];
}
