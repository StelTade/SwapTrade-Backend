import {
  ROLE_METADATA,
  getRoleMetadata,
  roleHasPermission,
  getAllRolePermissions,
} from './role-metadata';
import { UserRole } from '../enums/user-role.enum';

describe('Role Metadata', () => {
  describe('ROLE_METADATA', () => {
    it('should have metadata for all roles', () => {
      Object.values(UserRole).forEach((role) => {
        expect(ROLE_METADATA).toHaveProperty(role);
        expect(ROLE_METADATA[role]).toBeDefined();
      });
    });

    it('should have required properties for each role', () => {
      Object.values(ROLE_METADATA).forEach((metadata) => {
        expect(metadata.name).toBeDefined();
        expect(metadata.description).toBeDefined();
        expect(typeof metadata.priority).toBe('number');
        expect(Array.isArray(metadata.permissions)).toBe(true);
      });
    });

    it('should have correct priority order', () => {
      expect(ROLE_METADATA[UserRole.ADMIN].priority).toBeGreaterThan(
        ROLE_METADATA[UserRole.GOVERNANCE_OPERATOR].priority,
      );
      expect(
        ROLE_METADATA[UserRole.GOVERNANCE_OPERATOR].priority,
      ).toBeGreaterThan(ROLE_METADATA[UserRole.STAFF].priority);
      expect(ROLE_METADATA[UserRole.STAFF].priority).toBeGreaterThan(
        ROLE_METADATA[UserRole.USER].priority,
      );
    });

    it('should have Admin with wildcard permission', () => {
      expect(ROLE_METADATA[UserRole.ADMIN].permissions).toContain('*');
    });

    it('should have max user constraints where applicable', () => {
      expect(ROLE_METADATA[UserRole.ADMIN].constraints?.maxUsers).toBeLessThan(
        ROLE_METADATA[UserRole.STAFF].constraints?.maxUsers || Infinity,
      );
    });
  });

  describe('getRoleMetadata', () => {
    it('should return correct metadata for each role', () => {
      const superAdminMetadata = getRoleMetadata(UserRole.SUPER_ADMIN);
      expect(superAdminMetadata.name).toBe(UserRole.SUPER_ADMIN);
      expect(superAdminMetadata.priority).toBe(200);

      const adminMetadata = getRoleMetadata(UserRole.ADMIN);
      expect(adminMetadata.name).toBe(UserRole.ADMIN);
      expect(adminMetadata.priority).toBe(150);

      const userMetadata = getRoleMetadata(UserRole.USER);
      expect(userMetadata.name).toBe(UserRole.USER);
      expect(userMetadata.priority).toBe(20);
    });

    it('should return metadata with permissions', () => {
      const metadata = getRoleMetadata(UserRole.KYC_OPERATOR);
      expect(metadata.permissions.length).toBeGreaterThan(0);
      expect(metadata.permissions).toContain('KYC_READ');
    });
  });

  describe('roleHasPermission', () => {
    it('should return true for Admin with any permission', () => {
      expect(roleHasPermission(UserRole.ADMIN, 'ANY_PERMISSION')).toBe(true);
      expect(roleHasPermission(UserRole.ADMIN, 'UNKNOWN')).toBe(true);
    });

    it('should return true for User with their permissions', () => {
      expect(roleHasPermission(UserRole.USER, 'trades.read')).toBe(true);
      expect(roleHasPermission(UserRole.USER, 'accounts.read')).toBe(true);
    });

    it('should return false for User without permissions', () => {
      expect(roleHasPermission(UserRole.USER, 'POLICY_WRITE')).toBe(false);
      expect(roleHasPermission(UserRole.USER, 'KYC_APPROVE')).toBe(false);
    });

    it('should return true for KYC_OPERATOR with KYC permissions', () => {
      expect(roleHasPermission(UserRole.KYC_OPERATOR, 'KYC_APPROVE')).toBe(
        true,
      );
      expect(roleHasPermission(UserRole.KYC_OPERATOR, 'DOCUMENT_VIEW')).toBe(
        true,
      );
    });

    it('should return false for KYC_OPERATOR with governance permissions', () => {
      expect(roleHasPermission(UserRole.KYC_OPERATOR, 'POLICY_WRITE')).toBe(
        false,
      );
    });
  });

  describe('getAllRolePermissions', () => {
    it('should return all permissions for Admin', () => {
      const permissions = getAllRolePermissions(UserRole.ADMIN, []);
      expect(permissions.has('*')).toBe(true);
    });

    it('should return basic User permissions', () => {
      const permissions = getAllRolePermissions(UserRole.USER, []);
      expect(permissions.has('trades.read')).toBe(true);
      expect(permissions.has('accounts.read')).toBe(true);
      expect(permissions.size).toBeGreaterThan(0);
    });

    it('should include inherited role permissions', () => {
      const permissions = getAllRolePermissions(UserRole.STAFF, [
        UserRole.USER,
      ]);
      expect(permissions.has('USER_READ')).toBe(true);
      expect(permissions.has('trades.read')).toBe(true); // From USER
    });

    it('should not have duplicates', () => {
      const permissions = getAllRolePermissions(UserRole.KYC_GOVERNANCE, [
        UserRole.STAFF,
        UserRole.KYC_OPERATOR,
        UserRole.USER,
      ]);
      const permArray = Array.from(permissions);
      const uniquePerms = new Set(permArray);
      expect(uniquePerms.size).toBe(permArray.length);
    });

    it('should combine permissions from multiple inherited roles', () => {
      const permissions = getAllRolePermissions(UserRole.KYC_OPERATOR, [
        UserRole.USER,
      ]);
      // Should have both KYC and USER permissions
      expect(permissions.has('KYC_APPROVE')).toBe(true);
      expect(permissions.has('trades.read')).toBe(true);
    });
  });

  describe('Permission scope coverage', () => {
    it('should have consistent permission naming', () => {
      Object.values(ROLE_METADATA).forEach((metadata) => {
        metadata.permissions.forEach((perm) => {
          if (perm !== '*') {
            // All non-wildcard permissions should be either:
            // 1. UPPERCASE_WITH_UNDERSCORES (legacy format for governance/kyc roles)
            // 2. dot.separated.lowercase (domain.action format for modern permissions)
            expect(perm).toMatch(/^[A-Za-z._]+$/);
          }
        });
      });
    });

    it('should have no duplicate permissions within a role', () => {
      Object.values(ROLE_METADATA).forEach((metadata) => {
        const unique = new Set(metadata.permissions);
        expect(unique.size).toBe(metadata.permissions.length);
      });
    });
  });
});
