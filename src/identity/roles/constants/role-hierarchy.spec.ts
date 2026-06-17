import {
  ROLE_HIERARCHY,
  ROLE_INCOMPATIBILITIES,
  getInheritedRoles,
  areRolesCompatible,
  getRoleIncompatibilities,
} from './role-hierarchy';
import { UserRole } from '../enums/user-role.enum';

describe('Role Hierarchy', () => {
  describe('getInheritedRoles', () => {
    it('should return base user role with only itself', () => {
      const inherited = getInheritedRoles(UserRole.USER);
      expect(inherited).toContain(UserRole.USER);
      expect(inherited.length).toBe(1);
    });

    it('should return STAFF with inherited USER role', () => {
      const inherited = getInheritedRoles(UserRole.STAFF);
      expect(inherited).toContain(UserRole.STAFF);
      expect(inherited).toContain(UserRole.USER);
    });

    it('should return GOVERNANCE_OPERATOR with inherited roles', () => {
      const inherited = getInheritedRoles(UserRole.GOVERNANCE_OPERATOR);
      expect(inherited).toContain(UserRole.GOVERNANCE_OPERATOR);
      expect(inherited).toContain(UserRole.STAFF);
      expect(inherited).toContain(UserRole.USER);
    });

    it('should return SUPER_ADMIN with only itself (no parents)', () => {
      const inherited = getInheritedRoles(UserRole.SUPER_ADMIN);
      expect(inherited).toContain(UserRole.SUPER_ADMIN);
      expect(inherited.length).toBe(1);
    });

    it('should return ADMIN with inherited SUPER_ADMIN role', () => {
      const inherited = getInheritedRoles(UserRole.ADMIN);
      expect(inherited).toContain(UserRole.ADMIN);
      expect(inherited).toContain(UserRole.SUPER_ADMIN);
      expect(inherited.length).toBe(2);
    });

    it('should return KYC_OPERATOR with inherited USER role', () => {
      const inherited = getInheritedRoles(UserRole.KYC_OPERATOR);
      expect(inherited).toContain(UserRole.KYC_OPERATOR);
      expect(inherited).toContain(UserRole.USER);
    });

    it('should return KYC_GOVERNANCE with inherited roles', () => {
      const inherited = getInheritedRoles(UserRole.KYC_GOVERNANCE);
      expect(inherited).toContain(UserRole.KYC_GOVERNANCE);
      expect(inherited).toContain(UserRole.STAFF);
      expect(inherited).toContain(UserRole.KYC_OPERATOR);
      expect(inherited).toContain(UserRole.USER);
    });

    it('should not have duplicate roles in inheritance chain', () => {
      const inherited = getInheritedRoles(UserRole.KYC_GOVERNANCE);
      const unique = new Set(inherited);
      expect(unique.size).toBe(inherited.length);
    });
  });

  describe('areRolesCompatible', () => {
    it('should return true for same role', () => {
      expect(areRolesCompatible(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
      expect(areRolesCompatible(UserRole.USER, UserRole.USER)).toBe(true);
    });

    it('should return false when roles are incompatible', () => {
      expect(
        areRolesCompatible(UserRole.GOVERNANCE_OPERATOR, UserRole.KYC_OPERATOR),
      ).toBe(false);
      expect(
        areRolesCompatible(UserRole.KYC_OPERATOR, UserRole.GOVERNANCE_OPERATOR),
      ).toBe(false);
      expect(
        areRolesCompatible(
          UserRole.GOVERNANCE_OPERATOR,
          UserRole.KYC_GOVERNANCE,
        ),
      ).toBe(false);
    });

    it('should return true for compatible role combinations', () => {
      expect(areRolesCompatible(UserRole.ADMIN, UserRole.USER)).toBe(true);
      expect(areRolesCompatible(UserRole.STAFF, UserRole.USER)).toBe(true);
      expect(areRolesCompatible(UserRole.KYC_OPERATOR, UserRole.USER)).toBe(
        true,
      );
    });

    it('should handle bidirectional compatibility checks', () => {
      const role1 = UserRole.GOVERNANCE_OPERATOR;
      const role2 = UserRole.KYC_OPERATOR;
      expect(areRolesCompatible(role1, role2)).toBe(
        areRolesCompatible(role2, role1),
      );
    });
  });

  describe('getRoleIncompatibilities', () => {
    it('should return incompatibilities for GOVERNANCE_OPERATOR', () => {
      const incomp = getRoleIncompatibilities(UserRole.GOVERNANCE_OPERATOR);
      expect(incomp).toContain(UserRole.KYC_OPERATOR);
      expect(incomp).toContain(UserRole.KYC_GOVERNANCE);
    });

    it('should return incompatibilities for KYC_OPERATOR', () => {
      const incomp = getRoleIncompatibilities(UserRole.KYC_OPERATOR);
      expect(incomp).toContain(UserRole.GOVERNANCE_OPERATOR);
    });

    it('should return empty array for roles with no incompatibilities', () => {
      const incomp = getRoleIncompatibilities(UserRole.ADMIN);
      expect(incomp).toEqual([]);
    });
  });

  describe('ROLE_HIERARCHY', () => {
    it('should have entries for all roles', () => {
      Object.values(UserRole).forEach((role) => {
        expect(ROLE_HIERARCHY).toHaveProperty(role);
        expect(Array.isArray(ROLE_HIERARCHY[role])).toBe(true);
      });
    });

    it('should have SUPER_ADMIN with no parents', () => {
      expect(ROLE_HIERARCHY[UserRole.SUPER_ADMIN]).toEqual([]);
    });

    it('should have ADMIN with SUPER_ADMIN as parent', () => {
      expect(ROLE_HIERARCHY[UserRole.ADMIN]).toEqual([UserRole.SUPER_ADMIN]);
    });

    it('should have USER with no parents (base role)', () => {
      expect(ROLE_HIERARCHY[UserRole.USER]).toEqual([]);
    });

    it('should have valid parent roles in hierarchy', () => {
      Object.entries(ROLE_HIERARCHY).forEach(([role, parents]) => {
        // Verify the role itself is a valid UserRole value
        expect(Object.values(UserRole)).toContain(role);
        parents.forEach((parent) => {
          expect(Object.values(UserRole)).toContain(parent);
        });
      });
    });
  });

  describe('ROLE_INCOMPATIBILITIES', () => {
    it('should be a Map', () => {
      expect(ROLE_INCOMPATIBILITIES instanceof Map).toBe(true);
    });

    it('should have valid roles as keys', () => {
      ROLE_INCOMPATIBILITIES.forEach((_, role) => {
        expect(Object.values(UserRole)).toContain(role);
      });
    });

    it('should have valid roles in incompatibility lists', () => {
      ROLE_INCOMPATIBILITIES.forEach((incompatibilities) => {
        incompatibilities.forEach((role) => {
          expect(Object.values(UserRole)).toContain(role);
        });
      });
    });
  });
});
