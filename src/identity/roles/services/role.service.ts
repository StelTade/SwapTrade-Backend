/**
 * Role Service
 * Provides role queries, validation, and hierarchy operations
 *
 * @module identity/roles/services
 */

import { Injectable } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import {
  getInheritedRoles,
  areRolesCompatible,
  getRoleIncompatibilities,
} from '../constants/role-hierarchy';
import { getRoleMetadata, getAllRolePermissions } from '../types/role-metadata';
import { RoleMetadata, RoleContext } from '../types/role-metadata';

/**
 * Service for role management, validation, and queries
 * Centralizes all role-related business logic
 */
@Injectable()
export class RoleService {
  /**
   * Get metadata for a specific role
   * @param role - The role to get metadata for
   * @returns Role metadata with permissions and constraints
   */
  getRoleMetadata(role: UserRole): RoleMetadata {
    return getRoleMetadata(role);
  }

  /**
   * Check if a user with certain roles has a specific role
   * Includes role inheritance checking
   * @param userRoles - Array of roles assigned to user
   * @param requiredRole - Role to check for
   * @returns true if user has the role or inherits it
   */
  hasRole(userRoles: UserRole[], requiredRole: UserRole): boolean {
    return userRoles.some((role) => {
      if (role === requiredRole) {
        return true;
      }

      // Check if required role is inherited from this role
      const inherited = getInheritedRoles(role);
      return inherited.includes(requiredRole);
    });
  }

  /**
   * Get role priority (higher = more privileged)
   * Used for role comparison and escalation
   * @param role - The role to get priority for
   * @returns Numeric priority value
   */
  getRolePriority(role: UserRole): number {
    const metadata = this.getRoleMetadata(role);
    return metadata?.priority || 0;
  }

  /**
   * Get the highest priority role from a list
   * Useful for determining primary/effective role
   * @param roles - Array of roles to compare
   * @returns The role with highest priority
   */
  getHighestPriorityRole(roles: UserRole[]): UserRole {
    if (roles.length === 0) {
      return UserRole.USER; // Default fallback
    }

    return roles.reduce((highest, current) =>
      this.getRolePriority(current) > this.getRolePriority(highest)
        ? current
        : highest,
    );
  }

  /**
   * Create role context for a user
   * Encapsulates all role information needed for authorization
   * @param roles - Array of roles assigned to user
   * @returns Complete role context with inheritance
   */
  createRoleContext(roles: UserRole[]): RoleContext {
    const primaryRole = this.getHighestPriorityRole(roles);
    const inheritedRoles = getInheritedRoles(primaryRole);

    return {
      roles,
      primaryRole,
      inheritedRoles,
    };
  }

  /**
   * Validate that a set of roles can be assigned together
   * Checks for incompatibilities based on business rules
   * @param roles - Array of roles to validate
   * @returns Validation result with error details
   */
  validateRoleCombination(roles: UserRole[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for duplicates
    const uniqueRoles = new Set(roles);
    if (uniqueRoles.size !== roles.length) {
      errors.push('Duplicate roles not allowed');
    }

    // Check for incompatibilities
    for (let i = 0; i < roles.length; i++) {
      for (let j = i + 1; j < roles.length; j++) {
        const role1 = roles[i];
        const role2 = roles[j];

        if (!areRolesCompatible(role1, role2)) {
          errors.push(`Role ${role1} is incompatible with ${role2}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get all roles incompatible with a given role
   * @param role - The role to check incompatibilities for
   * @returns Array of incompatible roles
   */
  getIncompatibleRoles(role: UserRole): UserRole[] {
    return getRoleIncompatibilities(role);
  }

  /**
   * Check if a role can be added to an existing set
   * @param existingRoles - Current roles assigned to user
   * @param roleToAdd - Role being considered for addition
   * @returns true if role can be added
   */
  canAddRole(existingRoles: UserRole[], roleToAdd: UserRole): boolean {
    return this.validateRoleCombination([...existingRoles, roleToAdd]).valid;
  }

  /**
   * Get all permissions for a user based on their roles
   * @param userRoles - Array of roles assigned to user
   * @returns Set of all permissions (including inherited)
   */
  getAllUserPermissions(userRoles: UserRole[]): Set<string> {
    const allPermissions = new Set<string>();

    // Check for admin first
    for (const role of userRoles) {
      const metadata = this.getRoleMetadata(role);
      if (metadata.permissions.includes('*')) {
        return new Set(['*']);
      }
    }

    // Collect permissions from ALL assigned roles (not just primary)
    // Each role brings its own permissions AND its inherited roles' permissions
    for (const role of userRoles) {
      const inheritedRoles = getInheritedRoles(role);
      const rolePermissions = getAllRolePermissions(role, inheritedRoles);
      rolePermissions.forEach((perm) => allPermissions.add(perm));
    }

    return allPermissions;
  }

  /**
   * Check if a user has a specific permission
   * Takes into account role inheritance
   * @param userRoles - Array of roles assigned to user
   * @param permission - Permission to check for
   * @returns true if user has permission
   */
  hasPermission(userRoles: UserRole[], permission: string): boolean {
    const permissions = this.getAllUserPermissions(userRoles);
    return permissions.has('*') || permissions.has(permission);
  }

  /**
   * Get all inherited roles for a given role
   * Useful for role hierarchy visualization
   * @param role - The role to get inheritance for
   * @returns Array of inherited roles
   */
  getInheritedRoles(role: UserRole): UserRole[] {
    return getInheritedRoles(role);
  }

  /**
   * Sort roles by priority (highest first)
   * @param roles - Array of roles to sort
   * @returns Roles sorted by priority descending
   */
  sortByPriority(roles: UserRole[]): UserRole[] {
    return [...roles].sort(
      (a, b) => this.getRolePriority(b) - this.getRolePriority(a),
    );
  }
}
