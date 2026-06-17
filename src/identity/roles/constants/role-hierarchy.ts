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
 * SUPER_ADMIN (highest)
 *   └─ ADMIN
 *       ├─ COMPLIANCE_OFFICER
 *       ├─ SUPPORT_AGENT
 *       ├─ GOVERNANCE_OPERATOR
 *       │   └─ STAFF
 *       │       └─ TRADER
 *       │           └─ USER (base)
 *       └─ KYC_GOVERNANCE
 *           ├─ KYC_OPERATOR
 *           └─ STAFF
 *               └─ TRADER
 *                   └─ USER
 *
 * USER is the base role from which others inherit
 */
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  [UserRole.SUPER_ADMIN]: [],
  [UserRole.ADMIN]: [UserRole.SUPER_ADMIN],
  [UserRole.COMPLIANCE_OFFICER]: [UserRole.ADMIN],
  [UserRole.SUPPORT_AGENT]: [UserRole.ADMIN],
  [UserRole.TRADER]: [UserRole.USER],
  [UserRole.GOVERNANCE_OPERATOR]: [UserRole.STAFF],
  [UserRole.STAFF]: [UserRole.TRADER],
  [UserRole.USER]: [],
  [UserRole.KYC_OPERATOR]: [UserRole.USER],
  [UserRole.KYC_GOVERNANCE]: [UserRole.STAFF, UserRole.KYC_OPERATOR],
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
