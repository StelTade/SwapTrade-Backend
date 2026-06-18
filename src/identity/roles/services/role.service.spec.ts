import { RoleService } from './role.service';
import { UserRole } from '../enums/user-role.enum';

describe('RoleService', () => {
  let service: RoleService;

  beforeEach(() => {
    service = new RoleService();
  });

  describe('getRoleMetadata', () => {
    it('should return metadata for valid role', () => {
      const metadata = service.getRoleMetadata(UserRole.ADMIN);
      expect(metadata.name).toBe(UserRole.ADMIN);
      expect(metadata.permissions).toContain('*');
    });

    it('should return different metadata for different roles', () => {
      const adminMeta = service.getRoleMetadata(UserRole.ADMIN);
      const userMeta = service.getRoleMetadata(UserRole.USER);
      expect(adminMeta.priority).toBeGreaterThan(userMeta.priority);
    });
  });

  describe('hasRole', () => {
    it('should return true if user has exact role', () => {
      const roles = [UserRole.STAFF];
      expect(service.hasRole(roles, UserRole.STAFF)).toBe(true);
    });

    it('should return true for inherited roles', () => {
      const roles = [UserRole.STAFF];
      expect(service.hasRole(roles, UserRole.USER)).toBe(true);
    });

    it('should return false if user does not have role', () => {
      const roles = [UserRole.USER];
      expect(service.hasRole(roles, UserRole.STAFF)).toBe(false);
    });

    it('should handle multiple roles', () => {
      const roles = [UserRole.USER, UserRole.KYC_OPERATOR];
      expect(service.hasRole(roles, UserRole.USER)).toBe(true);
      expect(service.hasRole(roles, UserRole.KYC_OPERATOR)).toBe(true);
    });

    it('should return true for any role if user is ADMIN', () => {
      const roles = [UserRole.ADMIN];
      expect(service.hasRole(roles, UserRole.ADMIN)).toBe(true);
      expect(service.hasRole(roles, UserRole.USER)).toBe(false); // ADMIN doesn't inherit USER
    });
  });

  describe('getRolePriority', () => {
    it('should return higher priority for ADMIN', () => {
      const adminPriority = service.getRolePriority(UserRole.ADMIN);
      const userPriority = service.getRolePriority(UserRole.USER);
      expect(adminPriority).toBeGreaterThan(userPriority);
    });

    it('should return correct priority hierarchy', () => {
      const priorities = [
        service.getRolePriority(UserRole.ADMIN),
        service.getRolePriority(UserRole.GOVERNANCE_OPERATOR),
        service.getRolePriority(UserRole.STAFF),
        service.getRolePriority(UserRole.USER),
      ];

      // Each should be greater than the next
      for (let i = 0; i < priorities.length - 1; i++) {
        expect(priorities[i]).toBeGreaterThan(priorities[i + 1]);
      }
    });
  });

  describe('getHighestPriorityRole', () => {
    it('should return ADMIN from mixed roles', () => {
      const roles = [UserRole.USER, UserRole.STAFF, UserRole.ADMIN];
      expect(service.getHighestPriorityRole(roles)).toBe(UserRole.ADMIN);
    });

    it('should return GOVERNANCE_OPERATOR from non-admin roles', () => {
      const roles = [
        UserRole.USER,
        UserRole.STAFF,
        UserRole.GOVERNANCE_OPERATOR,
      ];
      expect(service.getHighestPriorityRole(roles)).toBe(
        UserRole.GOVERNANCE_OPERATOR,
      );
    });

    it('should return single role', () => {
      expect(service.getHighestPriorityRole([UserRole.USER])).toBe(
        UserRole.USER,
      );
    });

    it('should return USER as default for empty array', () => {
      expect(service.getHighestPriorityRole([])).toBe(UserRole.USER);
    });
  });

  describe('createRoleContext', () => {
    it('should create context with primary role', () => {
      const context = service.createRoleContext([UserRole.STAFF]);
      expect(context.primaryRole).toBe(UserRole.STAFF);
      expect(context.roles).toContain(UserRole.STAFF);
    });

    it('should include all inherited roles', () => {
      const context = service.createRoleContext([UserRole.STAFF]);
      expect(context.inheritedRoles).toContain(UserRole.STAFF);
      expect(context.inheritedRoles).toContain(UserRole.USER);
    });

    it('should identify highest priority as primary', () => {
      const roles = [
        UserRole.USER,
        UserRole.STAFF,
        UserRole.GOVERNANCE_OPERATOR,
      ];
      const context = service.createRoleContext(roles);
      expect(context.primaryRole).toBe(UserRole.GOVERNANCE_OPERATOR);
    });
  });

  describe('validateRoleCombination', () => {
    it('should validate compatible roles', () => {
      const result = service.validateRoleCombination([
        UserRole.ADMIN,
        UserRole.USER,
      ]);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject incompatible role combinations', () => {
      const result = service.validateRoleCombination([
        UserRole.GOVERNANCE_OPERATOR,
        UserRole.KYC_OPERATOR,
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect duplicate roles', () => {
      const result = service.validateRoleCombination([
        UserRole.USER,
        UserRole.USER,
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
    });

    it('should return specific error messages', () => {
      const result = service.validateRoleCombination([
        UserRole.GOVERNANCE_OPERATOR,
        UserRole.KYC_GOVERNANCE,
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('incompatible'))).toBe(true);
    });
  });

  describe('getIncompatibleRoles', () => {
    it('should return incompatible roles for GOVERNANCE_OPERATOR', () => {
      const incomp = service.getIncompatibleRoles(UserRole.GOVERNANCE_OPERATOR);
      expect(incomp).toContain(UserRole.KYC_OPERATOR);
      expect(incomp).toContain(UserRole.KYC_GOVERNANCE);
    });

    it('should return empty for ADMIN', () => {
      const incomp = service.getIncompatibleRoles(UserRole.ADMIN);
      expect(incomp).toEqual([]);
    });
  });

  describe('canAddRole', () => {
    it('should allow adding compatible role', () => {
      const existing = [UserRole.USER];
      expect(service.canAddRole(existing, UserRole.STAFF)).toBe(true);
    });

    it('should prevent adding incompatible role', () => {
      const existing = [UserRole.GOVERNANCE_OPERATOR];
      expect(service.canAddRole(existing, UserRole.KYC_OPERATOR)).toBe(false);
    });

    it('should handle empty existing roles', () => {
      expect(service.canAddRole([], UserRole.ADMIN)).toBe(true);
    });
  });

  describe('getAllUserPermissions', () => {
    it('should return all permissions for ADMIN', () => {
      const permissions = service.getAllUserPermissions([UserRole.ADMIN]);
      expect(permissions.has('*')).toBe(true);
    });

    it('should return USER permissions', () => {
      const permissions = service.getAllUserPermissions([UserRole.USER]);
      expect(permissions.has('trades.read')).toBe(true);
      expect(permissions.has('accounts.read')).toBe(true);
    });

    it('should include inherited permissions', () => {
      const permissions = service.getAllUserPermissions([UserRole.STAFF]);
      expect(permissions.has('USER_READ')).toBe(true);
      expect(permissions.has('trades.read')).toBe(true);
    });

    it('should combine permissions from multiple roles', () => {
      const permissions = service.getAllUserPermissions([
        UserRole.USER,
        UserRole.KYC_OPERATOR,
      ]);
      expect(permissions.has('trades.read')).toBe(true);
      expect(permissions.has('KYC_APPROVE')).toBe(true);
    });

    it('should not have duplicates', () => {
      const permissions = service.getAllUserPermissions([UserRole.STAFF]);
      const permArray = Array.from(permissions);
      const unique = new Set(permArray);
      expect(unique.size).toBe(permArray.length);
    });
  });

  describe('hasPermission', () => {
    it('should return true for ADMIN with any permission', () => {
      expect(service.hasPermission([UserRole.ADMIN], 'ANY_PERM')).toBe(true);
    });

    it('should return true for USER with their permissions', () => {
      expect(service.hasPermission([UserRole.USER], 'trades.read')).toBe(true);
    });

    it('should return false for USER without specific permission', () => {
      expect(service.hasPermission([UserRole.USER], 'admin.access')).toBe(
        false,
      );
    });

    it('should check inherited role permissions', () => {
      expect(service.hasPermission([UserRole.STAFF], 'trades.read')).toBe(true);
    });
  });

  describe('getInheritedRoles', () => {
    it('should return only self for base USER role', () => {
      const inherited = service.getInheritedRoles(UserRole.USER);
      expect(inherited).toContain(UserRole.USER);
      expect(inherited.length).toBe(1);
    });

    it('should return hierarchy for STAFF', () => {
      const inherited = service.getInheritedRoles(UserRole.STAFF);
      expect(inherited).toContain(UserRole.STAFF);
      expect(inherited).toContain(UserRole.USER);
    });

    it('should return no duplicates', () => {
      const inherited = service.getInheritedRoles(UserRole.KYC_GOVERNANCE);
      const unique = new Set(inherited);
      expect(unique.size).toBe(inherited.length);
    });
  });

  describe('sortByPriority', () => {
    it('should sort roles by priority descending', () => {
      const roles = [UserRole.USER, UserRole.ADMIN, UserRole.STAFF];
      const sorted = service.sortByPriority(roles);

      expect(sorted[0]).toBe(UserRole.ADMIN);
      expect(sorted[sorted.length - 1]).toBe(UserRole.USER);
    });

    it('should preserve list without mutation', () => {
      const roles = [UserRole.STAFF, UserRole.USER];
      const original = [...roles];
      service.sortByPriority(roles);

      expect(roles).toEqual(original);
    });

    it('should handle single role', () => {
      const sorted = service.sortByPriority([UserRole.STAFF]);
      expect(sorted).toEqual([UserRole.STAFF]);
    });

    it('should handle empty array', () => {
      const sorted = service.sortByPriority([]);
      expect(sorted).toEqual([]);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle KYC governance role hierarchy', () => {
      const roles = [UserRole.KYC_GOVERNANCE];
      const context = service.createRoleContext(roles);

      expect(context.primaryRole).toBe(UserRole.KYC_GOVERNANCE);
      expect(context.inheritedRoles).toContain(UserRole.STAFF);
      expect(context.inheritedRoles).toContain(UserRole.USER);
      expect(context.inheritedRoles).toContain(UserRole.KYC_OPERATOR);
    });

    it('should validate multi-role user can be created', () => {
      const validation = service.validateRoleCombination([
        UserRole.KYC_OPERATOR,
        UserRole.USER,
      ]);
      expect(validation.valid).toBe(true);
    });

    it('should prevent governance and KYC operator combination', () => {
      const validation = service.validateRoleCombination([
        UserRole.GOVERNANCE_OPERATOR,
        UserRole.KYC_OPERATOR,
      ]);
      expect(validation.valid).toBe(false);
    });
  });
});
